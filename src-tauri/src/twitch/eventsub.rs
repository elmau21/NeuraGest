use crate::commands::{app_access_token, refresh_talents, valid_tokens, TALENTS};
use futures_util::{future::join_all, SinkExt, StreamExt};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use tauri::{AppHandle, Emitter};
use tokio::sync::RwLock;
use tokio_tungstenite::connect_async;

const EVENTSUB_WS: &str = "wss://eventsub.wss.twitch.tv/ws";

/// Twitch: coste máximo **total** de suscripciones WebSocket = 10 (no por conexión).
const WS_COST_BUDGET: usize = 10;

/// Priorizamos `stream.online` (coste 1): cubre hasta 10 talentos.
/// `stream.offline` y el resto de la cartera van por Helix polling.
const CORE_SUBS: &[(&str, &str)] = &[("stream.online", "1")];

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
static LAST_EVENT_AT: RwLock<Option<String>> = RwLock::const_new(None);
static SESSION_ID: RwLock<Option<String>> = RwLock::const_new(None);
static SUBSCRIPTION_COUNT: AtomicU32 = AtomicU32::new(0);
static ACTIVE_CONNECTIONS: AtomicU32 = AtomicU32::new(0);
static LAST_ERROR: RwLock<Option<String>> = RwLock::const_new(None);
static RICH_ENABLED: AtomicBool = AtomicBool::new(false);

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

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventSubStatus {
    pub state: String,
    pub session_id: Option<String>,
    pub subscriptions: u32,
    pub last_event_at: Option<String>,
    pub rich_enabled: bool,
    pub last_error: Option<String>,
    pub active_connections: u32,
}

pub async fn eventsub_status() -> EventSubStatus {
    let state = *EVENTSUB_STATE.read().await;
    EventSubStatus {
        state: state.label().into(),
        session_id: SESSION_ID.read().await.clone(),
        subscriptions: SUBSCRIPTION_COUNT.load(Ordering::SeqCst),
        last_event_at: LAST_EVENT_AT.read().await.clone(),
        rich_enabled: RICH_ENABLED.load(Ordering::SeqCst),
        last_error: LAST_ERROR.read().await.clone(),
        active_connections: ACTIVE_CONNECTIONS.load(Ordering::SeqCst),
    }
}

async fn set_state(app: Option<&AppHandle>, state: EventSubState) {
    *EVENTSUB_STATE.write().await = state;
    if let Some(handle) = app {
        let status = eventsub_status().await;
        let _ = handle.emit("eventsub-status", status);
    }
}

async fn set_last_error(message: impl Into<String>) {
    *LAST_ERROR.write().await = Some(message.into());
}

async fn clear_last_error() {
    *LAST_ERROR.write().await = None;
}

async fn resolve_broadcaster_ids(client_id: &str, token: &str) -> Result<Vec<(String, String)>, String> {
    let targets = crate::twitch::roster::load_roster_targets().await;
    let mut url = url::Url::parse("https://api.twitch.tv/helix/users").map_err(|e| e.to_string())?;
    let mut seen_ids = std::collections::HashSet::new();
    let mut seen_logins = std::collections::HashSet::new();
    let mut appended = 0usize;
    for target in &targets {
        if let Some(id) = target.twitch_user_id.as_deref().filter(|v| !v.is_empty()) {
            if seen_ids.insert(id.to_string()) {
                url.query_pairs_mut().append_pair("id", id);
                appended += 1;
            }
        } else if seen_logins.insert(target.login.to_lowercase()) {
            url.query_pairs_mut().append_pair("login", &target.login);
            appended += 1;
        }
    }
    if appended == 0 {
        return Ok(Vec::new());
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
    sub_type: &str,
    version: &str,
    condition: Value,
) -> Result<(), String> {
    let body = json!({
        "type": sub_type,
        "version": version,
        "condition": condition,
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

#[derive(Debug, Deserialize)]
struct SubListResponse {
    data: Vec<SubListItem>,
}

#[derive(Debug, Deserialize)]
struct SubListItem {
    id: String,
    status: String,
    transport: SubTransport,
}

#[derive(Debug, Deserialize)]
struct SubTransport {
    method: String,
}

/// Libera coste WS huérfano de sesiones anteriores (budget total = 10).
async fn purge_websocket_subscriptions(client_id: &str, token: &str) {
    let client = reqwest::Client::new();
    let mut cursor: Option<String> = None;
    loop {
        let mut url = url::Url::parse("https://api.twitch.tv/helix/eventsub/subscriptions")
            .expect("url válida");
        if let Some(c) = &cursor {
            url.query_pairs_mut().append_pair("after", c);
        }
        let response = match client
            .get(url)
            .header("Client-Id", client_id)
            .bearer_auth(token)
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                tracing::warn!(%e, "No se pudo listar suscripciones EventSub");
                return;
            }
        };
        if !response.status().is_success() {
            tracing::warn!(status = %response.status(), "Listar EventSub falló");
            return;
        }
        let body: Value = match response.json().await {
            Ok(v) => v,
            Err(e) => {
                tracing::warn!(%e, "JSON EventSub list inválido");
                return;
            }
        };
        let parsed: SubListResponse = match serde_json::from_value(body.clone()) {
            Ok(p) => p,
            Err(_) => break,
        };
        for item in parsed.data {
            if item.transport.method.eq_ignore_ascii_case("websocket") {
                let del = client
                    .delete(format!(
                        "https://api.twitch.tv/helix/eventsub/subscriptions?id={}",
                        item.id
                    ))
                    .header("Client-Id", client_id)
                    .bearer_auth(token)
                    .send()
                    .await;
                match del {
                    Ok(r) if r.status().is_success() || r.status().as_u16() == 404 => {
                        tracing::info!(id = %item.id, status = %item.status, "EventSub WS huérfana eliminada");
                    }
                    Ok(r) => tracing::warn!(status = %r.status(), id = %item.id, "No se pudo borrar sub EventSub"),
                    Err(e) => tracing::warn!(%e, "Error borrando sub EventSub"),
                }
            }
        }
        cursor = body
            .pointer("/pagination/cursor")
            .and_then(Value::as_str)
            .map(str::to_string);
        if cursor.is_none() {
            break;
        }
    }
}

/// Suscribe tipos core en paralelo (ventana ~10s tras session_welcome).
async fn subscribe_core_batch(
    client_id: &str,
    user_token: &str,
    session_id: &str,
    broadcasters: &[(String, String)],
) -> (u32, Option<String>) {
    let mut tasks = Vec::with_capacity(broadcasters.len() * CORE_SUBS.len());
    for (broadcaster_id, _) in broadcasters {
        for (sub_type, version) in CORE_SUBS {
            let client_id = client_id.to_string();
            let user_token = user_token.to_string();
            let session_id = session_id.to_string();
            let broadcaster_id = broadcaster_id.clone();
            let sub_type = (*sub_type).to_string();
            let version = (*version).to_string();
            tasks.push(async move {
                create_subscription(
                    &client_id,
                    &user_token,
                    &session_id,
                    &sub_type,
                    &version,
                    json!({ "broadcaster_user_id": broadcaster_id }),
                )
                .await
            });
        }
    }

    let results = join_all(tasks).await;
    let mut ok = 0u32;
    let mut first_err: Option<String> = None;
    for result in results {
        match result {
            Ok(()) => ok += 1,
            Err(err) => {
                tracing::warn!(%err, "Fallo al crear suscripción EventSub");
                if first_err.is_none() {
                    first_err = Some(err);
                }
            }
        }
    }
    (ok, first_err)
}

fn event_login(event: &Value, sub_type: &str) -> String {
    let keys = if sub_type == "channel.raid" {
        ["to_broadcaster_user_login", "from_broadcaster_user_login", "broadcaster_user_login"]
    } else {
        ["broadcaster_user_login", "to_broadcaster_user_login", "from_broadcaster_user_login"]
    };
    for key in keys {
        if let Some(login) = event.get(key).and_then(Value::as_str) {
            if !login.is_empty() {
                return login.to_string();
            }
        }
    }
    String::new()
}

/// Fragmento estable para el panel de coordinación (raid / shared chat).
fn coordination_payload(event_type: &str, event: &Value) -> Option<Value> {
    if event_type == "channel.raid" {
        return Some(json!({
            "fromLogin": event.get("from_broadcaster_user_login").and_then(Value::as_str),
            "fromName": event.get("from_broadcaster_user_name").and_then(Value::as_str),
            "toLogin": event.get("to_broadcaster_user_login").and_then(Value::as_str),
            "toName": event.get("to_broadcaster_user_name").and_then(Value::as_str),
            "viewers": event.get("viewers").and_then(Value::as_u64),
        }));
    }
    if event_type.starts_with("channel.shared_chat") {
        let participants: Vec<Value> = event
            .get("participants")
            .and_then(Value::as_array)
            .map(|rows| {
                rows.iter()
                    .filter_map(|row| {
                        let login = row
                            .get("broadcaster_user_login")
                            .or_else(|| row.get("user_login"))
                            .and_then(Value::as_str)?;
                        if login.is_empty() {
                            return None;
                        }
                        Some(json!({
                            "login": login,
                            "name": row
                                .get("broadcaster_user_name")
                                .or_else(|| row.get("user_name"))
                                .and_then(Value::as_str)
                                .unwrap_or(login),
                        }))
                    })
                    .collect()
            })
            .unwrap_or_default();
        return Some(json!({
            "sessionId": event.get("session_id").and_then(Value::as_str),
            "hostLogin": event.get("host_broadcaster_user_login").and_then(Value::as_str),
            "hostName": event.get("host_broadcaster_user_name").and_then(Value::as_str),
            "broadcasterLogin": event.get("broadcaster_user_login").and_then(Value::as_str),
            "participants": participants,
        }));
    }
    None
}

async fn handle_notification(app: &AppHandle, payload: &NotificationPayload) -> Result<(), String> {
    let event_type = &payload.subscription.sub_type;
    let event = &payload.event;
    let login = event_login(event, event_type);
    let stream_id = event
        .get("id")
        .or_else(|| event.get("session_id"))
        .and_then(Value::as_str);
    let category = event
        .get("category_name")
        .or_else(|| event.get("game_name"))
        .and_then(Value::as_str);
    let title = event.get("title").and_then(Value::as_str);
    let coord_payload = coordination_payload(event_type, event);

    if !login.is_empty() {
        crate::twitch::metrics::insert_stream_event(
            &login,
            event_type,
            stream_id,
            category,
            title,
            coord_payload.as_ref(),
        )
        .await
        .ok();
        *LAST_EVENT_AT.write().await = Some(chrono::Utc::now().to_rfc3339());

        let _ = app.emit(
            "helix-eventsub",
            json!({
                "type": event_type,
                "login": login,
                "streamId": stream_id,
                "categoryName": category,
                "title": title,
                "event": event,
                "payload": coord_payload,
                "occurredAt": chrono::Utc::now().to_rfc3339(),
            }),
        );

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

    if matches!(
        event_type.as_str(),
        "stream.online" | "stream.offline" | "channel.update"
    ) {
        let app_handle = app.clone();
        tauri::async_runtime::spawn(async move {
            match refresh_talents(app_handle.clone()).await {
                Ok(snapshots) => {
                    let live_count = snapshots.iter().filter(|row| row.is_live).count();
                    tracing::info!(live_count, "Helix tras EventSub; empujando talents-updated");
                    let _ = app_handle.emit("talents-updated", &snapshots);
                }
                Err(error) => tracing::warn!(%error, "Refresco Helix tras EventSub falló"),
            }
        });
    }

    Ok(())
}

async fn run_session(
    app: AppHandle,
    client_id: String,
    user_token: String,
    broadcasters: Vec<(String, String)>,
) -> Result<u32, String> {
    let (ws, _) = connect_async(EVENTSUB_WS)
        .await
        .map_err(|e| format!("WebSocket EventSub: {e}"))?;

    let (mut write, mut read) = ws.split();
    let mut session_subs = 0u32;
    let mut credited = false;

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

                // WebSocket EventSub exige user access token (no app token).
                let (subs, first_err) = subscribe_core_batch(
                    &client_id,
                    &user_token,
                    &welcome.session.id,
                    &broadcasters,
                )
                .await;

                if subs == 0 {
                    let detail = first_err.unwrap_or_else(|| {
                        "Twitch no aceptó suscripciones (coste/token/sesión)".into()
                    });
                    return Err(detail);
                }

                session_subs = subs;
                SUBSCRIPTION_COUNT.fetch_add(subs, Ordering::SeqCst);
                ACTIVE_CONNECTIONS.fetch_add(1, Ordering::SeqCst);
                credited = true;
                RICH_ENABLED.store(false, Ordering::SeqCst);
                set_state(Some(&app), EventSubState::Connected).await;
                FALLBACK_ACTIVE.store(false, Ordering::SeqCst);
                clear_last_error().await;
                tracing::info!(
                    session_id = %welcome.session.id,
                    subs,
                    batch = broadcasters.len(),
                    "EventSub sesión conectada"
                );
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
    if credited {
        SUBSCRIPTION_COUNT.fetch_sub(session_subs, Ordering::SeqCst);
        ACTIVE_CONNECTIONS.fetch_sub(1, Ordering::SeqCst);
        if ACTIVE_CONNECTIONS.load(Ordering::SeqCst) == 0 {
            *SESSION_ID.write().await = None;
            if *EVENTSUB_STATE.read().await == EventSubState::Connected {
                set_state(Some(&app), EventSubState::Disconnected).await;
            }
        }
    }
    Ok(session_subs)
}

async fn run_fleet(app: AppHandle) -> Result<u32, String> {
    let user_tokens = valid_tokens().await.map_err(|_| {
        "EventSub WebSocket requiere sesión Twitch (user token). Helix polling sigue activo.".to_string()
    })?;

    // Resolver IDs con app token (público); suscribir con user token (requisito WS).
    let app_token = app_access_token(&app).await?;
    let client_id = user_tokens.client_id.clone();
    let user_token = user_tokens.access_token.clone();

    // Liberar coste WS de sesiones muertas antes de crear nuevas.
    purge_websocket_subscriptions(&client_id, &user_token).await;

    let broadcasters = resolve_broadcaster_ids(&client_id, &app_token).await?;
    if broadcasters.is_empty() {
        return Err("Sin broadcasters NeuraLive para EventSub".into());
    }

    // Coste WS total = 10: una sola conexión, hasta 10× stream.online.
    let covered: Vec<(String, String)> = broadcasters.into_iter().take(WS_COST_BUDGET).collect();
    let covered_n = covered.len();
    let uncovered = TALENTS.len().saturating_sub(covered_n);

    tracing::info!(
        covered = covered_n,
        uncovered,
        budget = WS_COST_BUDGET,
        "Iniciando EventSub WS (auth=user token; offline/resto vía Helix poll)"
    );

    // Helix poll complementario siempre (offline + talento fuera del cupo WS).
    ensure_polling_fallback(app.clone());

    run_session(app, client_id, user_token, covered).await
}

fn ensure_polling_fallback(app: AppHandle) {
    if FALLBACK_ACTIVE.swap(true, Ordering::SeqCst) {
        return;
    }
    tauri::async_runtime::spawn(async move {
        tracing::info!("Helix polling complementario cada 60s (offline + cobertura parcial EventSub)");
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(60)).await;
            if let Err(error) = refresh_talents(app.clone()).await {
                tracing::warn!(%error, "Helix poll complementario falló");
            }
        }
    });
}

async fn enter_fallback(app: &AppHandle, consecutive_failures: u32, error: &str) {
    set_last_error(error).await;
    set_state(Some(app), EventSubState::FallbackPolling).await;
    ensure_polling_fallback(app.clone());
    let shift = consecutive_failures.min(4);
    let backoff_secs = (5u64 << shift).min(120);
    tracing::warn!(
        %error,
        consecutive_failures,
        backoff_secs,
        "EventSub en modo alterno (polling Helix); reintento con backoff"
    );
    tokio::time::sleep(std::time::Duration::from_secs(backoff_secs)).await;
}

pub async fn start_eventsub_loop(app: AppHandle) {
    let mut consecutive_failures = 0u32;
    loop {
        SUBSCRIPTION_COUNT.store(0, Ordering::SeqCst);
        ACTIVE_CONNECTIONS.store(0, Ordering::SeqCst);
        *SESSION_ID.write().await = None;
        set_state(Some(&app), EventSubState::Connecting).await;

        match run_fleet(app.clone()).await {
            Ok(subs) if subs > 0 => {
                consecutive_failures = 0;
                tracing::info!(subs, "Sesión EventSub cerrada limpiamente; reconectando…");
                set_state(Some(&app), EventSubState::Disconnected).await;
                tokio::time::sleep(std::time::Duration::from_secs(3)).await;
            }
            Ok(_) => {
                consecutive_failures = consecutive_failures.saturating_add(1);
                enter_fallback(
                    &app,
                    consecutive_failures,
                    "EventSub conectó el WS pero 0 suscripciones (límite de coste o sesión inválida). Helix polling activo.",
                )
                .await;
            }
            Err(error) => {
                consecutive_failures = consecutive_failures.saturating_add(1);
                enter_fallback(&app, consecutive_failures, &error).await;
            }
        }
    }
}
