use crate::commands::{app_access_token, refresh_talents, TALENTS};
use crate::commands::twitch_profiles;
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter};
use tokio::sync::RwLock;
use tokio_tungstenite::connect_async;

const EVENTSUB_WS: &str = "wss://eventsub.wss.twitch.tv/ws";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EventSubState {
    Disconnected,
    Connecting,
    Connected,
    FallbackPolling,
}

impl EventSubState {
    fn label(self) -> &'static str {
        match self {
            Self::Disconnected => "disconnected",
            Self::Connecting => "connecting",
            Self::Connected => "connected",
            Self::FallbackPolling => "fallback_polling",
        }
    }
}

static EVENTSUB_STATE: RwLock<EventSubState> = RwLock::const_new(EventSubState::Disconnected);
static FALLBACK_ACTIVE: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Deserialize)]
struct WsMessage {
    metadata: WsMetadata,
    payload: Value,
}

#[derive(Debug, Deserialize)]
struct WsMetadata {
    message_type: String,
}

#[derive(Debug, Deserialize)]
struct WelcomePayload {
    session: WelcomeSession,
}

#[derive(Debug, Deserialize)]
struct WelcomeSession {
    id: String,
}

#[derive(Debug, Deserialize)]
struct NotificationPayload {
    subscription: NotificationSubscription,
    event: Value,
}

#[derive(Debug, Deserialize)]
struct NotificationSubscription {
    #[serde(rename = "type")]
    sub_type: String,
}

#[derive(Debug, Deserialize)]
struct HelixUser {
    id: String,
    login: String,
}

#[derive(Debug, Deserialize)]
struct HelixUsersResponse {
    data: Vec<HelixUser>,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventSubStatus {
    pub state: String,
    pub session_id: Option<String>,
    pub subscriptions: u32,
    pub last_event_at: Option<String>,
}

static LAST_EVENT_AT: RwLock<Option<String>> = RwLock::const_new(None);
static SESSION_ID: RwLock<Option<String>> = RwLock::const_new(None);
static SUBSCRIPTION_COUNT: RwLock<u32> = RwLock::const_new(0);

pub async fn eventsub_status() -> EventSubStatus {
    let state = *EVENTSUB_STATE.read().await;
    EventSubStatus {
        state: state.label().into(),
        session_id: SESSION_ID.read().await.clone(),
        subscriptions: *SUBSCRIPTION_COUNT.read().await,
        last_event_at: LAST_EVENT_AT.read().await.clone(),
    }
}

async fn set_state(state: EventSubState) {
    *EVENTSUB_STATE.write().await = state;
}

async fn resolve_broadcaster_ids(client_id: &str, token: &str) -> Result<Vec<(String, String)>, String> {
    let mut url = url::Url::parse("https://api.twitch.tv/helix/users").map_err(|e| e.to_string())?;
    for login in TALENTS {
        url.query_pairs_mut().append_pair("login", login);
    }
    let response = reqwest::Client::new()
        .get(url)
        .header("Client-Id", client_id)
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("Helix users para EventSub: {}", response.status()));
    }
    let body: HelixUsersResponse = response.json().await.map_err(|e| e.to_string())?;
    Ok(body
        .data
        .into_iter()
        .map(|user| (user.id, user.login))
        .collect())
}

async fn create_subscription(
    client_id: &str,
    token: &str,
    session_id: &str,
    broadcaster_id: &str,
    sub_type: &str,
) -> Result<(), String> {
    let body = json!({
        "type": sub_type,
        "version": "1",
        "condition": { "broadcaster_user_id": broadcaster_id },
        "transport": { "method": "websocket", "session_id": session_id }
    });
    let response = reqwest::Client::new()
        .post("https://api.twitch.tv/helix/eventsub/subscriptions")
        .header("Client-Id", client_id)
        .header("Content-Type", "application/json")
        .bearer_auth(token)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if response.status().is_success() || response.status().as_u16() == 409 {
        return Ok(());
    }
    let status = response.status();
    let text = response.text().await.unwrap_or_default();
    Err(format!("EventSub subscribe {sub_type} ({status}): {text}"))
}

async fn subscribe_all(
    client_id: &str,
    token: &str,
    session_id: &str,
) -> Result<u32, String> {
    let broadcasters = resolve_broadcaster_ids(client_id, token).await?;
    let mut count = 0u32;
    for (broadcaster_id, _) in &broadcasters {
        for sub_type in ["stream.online", "stream.offline"] {
            if create_subscription(client_id, token, session_id, broadcaster_id, sub_type)
                .await
                .is_ok()
            {
                count += 1;
            }
        }
    }
    Ok(count)
}

async fn handle_notification(app: &AppHandle, payload: &NotificationPayload) -> Result<(), String> {
    let event_type = &payload.subscription.sub_type;
    let event = &payload.event;
    let login = event
        .get("broadcaster_user_login")
        .and_then(Value::as_str)
        .unwrap_or("");
    let stream_id = event.get("id").and_then(Value::as_str);
    let category = event
        .get("category_name")
        .or_else(|| event.get("game_name"))
        .and_then(Value::as_str);
    let title = event.get("title").and_then(Value::as_str);

    if !login.is_empty() {
        crate::twitch::metrics::insert_stream_event(
            login,
            event_type,
            stream_id,
            category,
            title,
        )
        .await
        .ok();
        *LAST_EVENT_AT.write().await = Some(chrono::Utc::now().to_rfc3339());

        if event_type == "stream.offline" {
            let _ = app.emit(
                "stream-offline",
                json!({
                    "login": login,
                    "streamId": stream_id,
                    "categoryName": category,
                    "title": title,
                    "occurredAt": chrono::Utc::now().to_rfc3339(),
                }),
            );
        }
    }

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(error) = refresh_talents(app_handle).await {
            tracing::warn!(%error, "Refresco Helix tras EventSub falló");
        }
    });

    Ok(())
}

async fn run_session(app: AppHandle) -> Result<(), String> {
    set_state(EventSubState::Connecting).await;
    let (ws, _) = connect_async(EVENTSUB_WS)
        .await
        .map_err(|e| format!("WebSocket EventSub: {e}"))?;

    let (mut write, mut read) = ws.split();
    let client_id = twitch_profiles::configured_client_id_for(&app).await?;
    let token = app_access_token(&app).await?;

    while let Some(message) = read.next().await {
        let message = message.map_err(|e| format!("EventSub read: {e}"))?;
        if !message.is_text() {
            continue;
        }
        let text = message.into_text().map_err(|e| format!("EventSub text: {e}"))?;
        let parsed: WsMessage =
            serde_json::from_str(&text).map_err(|e| format!("EventSub JSON: {e}"))?;

        match parsed.metadata.message_type.as_str() {
            "session_welcome" => {
                let welcome: WelcomePayload = serde_json::from_value(parsed.payload)
                    .map_err(|e| format!("Welcome payload: {e}"))?;
                *SESSION_ID.write().await = Some(welcome.session.id.clone());
                let subs = subscribe_all(&client_id, &token, &welcome.session.id).await?;
                *SUBSCRIPTION_COUNT.write().await = subs;
                set_state(EventSubState::Connected).await;
                FALLBACK_ACTIVE.store(false, Ordering::SeqCst);
                tracing::info!(session_id = %welcome.session.id, subs, "EventSub conectado");
            }
            "session_keepalive" => {}
            "session_reconnect" => {
                tracing::info!("EventSub solicita reconexión");
                break;
            }
            "notification" => {
                let notification: NotificationPayload = serde_json::from_value(parsed.payload)
                    .map_err(|e| format!("Notification payload: {e}"))?;
                handle_notification(&app, &notification).await.ok();
            }
            "revocation" => {
                tracing::warn!("EventSub revocó una suscripción");
            }
            other => tracing::debug!(message_type = other, "EventSub mensaje ignorado"),
        }
    }

    let _ = write.close().await;
    Ok(())
}

pub async fn start_eventsub_loop(app: AppHandle) {
    loop {
        match run_session(app.clone()).await {
            Ok(()) => tracing::info!("EventSub sesión cerrada, reconectando…"),
            Err(error) => {
                tracing::warn!(%error, "EventSub desconectado");
                set_state(EventSubState::FallbackPolling).await;
                if !FALLBACK_ACTIVE.swap(true, Ordering::SeqCst) {
                    spawn_polling_fallback(app.clone());
                }
            }
        }
        *SESSION_ID.write().await = None;
        *SUBSCRIPTION_COUNT.write().await = 0;
        set_state(EventSubState::Disconnected).await;
        tokio::time::sleep(std::time::Duration::from_secs(5)).await;
    }
}

fn spawn_polling_fallback(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        tracing::info!("EventSub fallback: polling Helix cada 60s");
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(60)).await;
            let state = *EVENTSUB_STATE.read().await;
            if state == EventSubState::Connected {
                FALLBACK_ACTIVE.store(false, Ordering::SeqCst);
                break;
            }
            if let Err(error) = refresh_talents(app.clone()).await {
                tracing::warn!(%error, "Fallback Helix poll falló");
            }
        }
    });
}
