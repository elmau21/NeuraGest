pub mod agency_bridge;
pub mod discord_rpc;
pub mod google_calendar;
pub mod oauth_callback;
pub mod ops_bridge;
pub mod supabase_bridge;
pub mod twitch_profiles;
pub mod usable_bridge;

use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::OnceLock, time::Duration};
use tokio::sync::Mutex;

const SERVICE: &str = "com.neuralive.neuragest";
const ACCOUNT: &str = "twitch-oauth";
const OAUTH_SCOPES: &str = "user:read:email moderator:read:followers channel:read:subscriptions clips:edit";
pub(crate) const TALENTS: [&str; 10] = ["arikyu_","nosomevt","kumitacui","ryonikku","suimivt","tesitoazul","shisuvr","bhikoruvt","ashitakaseiren","cold__vt"];
static APP_TOKEN: OnceLock<Mutex<Option<AppAccessToken>>> = OnceLock::new();
static PENDING_DEVICE: OnceLock<Mutex<Option<PendingDeviceFlow>>> = OnceLock::new();

struct PendingDeviceFlow {
    device_code: String,
    client_id: String,
    expires_at: tokio::time::Instant,
    interval: u64,
}

#[derive(Clone)]
struct AppAccessToken {
    access_token: String,
    expires_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct StoredTokens {
    access_token: String,
    refresh_token: String,
    expires_at: i64,
    client_id: String,
    scopes: Vec<String>,
    #[serde(default)]
    login: Option<String>,
    #[serde(default)]
    display_name: Option<String>,
    #[serde(default)]
    avatar_url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TwitchAuthState {
    connected: bool,
    display_name: Option<String>,
    login: Option<String>,
    avatar_url: Option<String>,
    expires_at: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TwitchDeviceCodeInfo {
    user_code: String,
    verification_uri: String,
    expires_in: u64,
    interval: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TwitchUserProfile {
    login: String,
    display_name: String,
    avatar_url: String,
    expires_at: i64,
}

#[derive(Deserialize)]
pub(crate) struct TokenResponse {
    access_token: String,
    #[serde(default)]
    refresh_token: String,
    expires_in: i64,
    #[serde(default)]
    scope: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct DeviceCodeResponse {
    device_code: String,
    user_code: String,
    expires_in: u64,
    interval: u64,
    verification_uri: String,
}

#[derive(Debug, Deserialize)]
struct OAuthErrorResponse {
    #[serde(default, alias = "error")]
    message: String,
}

#[derive(Debug, Deserialize)]
struct HelixResponse<T> {
    data: Vec<T>,
}

#[derive(Debug, Deserialize)]
struct HelixUser {
    id: String,
    login: String,
    display_name: String,
    description: String,
    profile_image_url: String,
    #[serde(default)]
    offline_image_url: String,
    created_at: String,
}

#[derive(Debug, Deserialize)]
struct HelixStream {
    id: String,
    user_login: String,
    game_name: String,
    title: String,
    viewer_count: u64,
    started_at: String,
}

/// Respuesta de GET /helix/channels/followers (solo necesitamos `total`).
/// Con App Token Twitch no entrega la lista, pero sí el conteo público del canal.
#[derive(Debug, Deserialize)]
struct HelixChannelFollowers {
    total: u64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TalentSnapshot {
    pub(crate) id: String,
    pub(crate) login: String,
    pub(crate) display_name: String,
    pub(crate) avatar: String,
    pub(crate) description: String,
    pub(crate) is_live: bool,
    pub(crate) viewers: u64,
    pub(crate) followers: u64,
    pub(crate) category: String,
    pub(crate) title: String,
    pub(crate) created_at: String,
    pub(crate) stream_id: Option<String>,
    pub(crate) started_at: Option<String>,
    /// URL de imagen offline del canal (vacía si el talento no la configuró).
    #[serde(default)]
    pub(crate) offline_image_url: String,
}

pub(crate) const TWITCH_CONFIG_MISSING: &str =
    "Falta la configuración de Twitch en esta instalación. Contacta al administrador o reinstala NeuraGest.";

async fn helix_client_id(app: &tauri::AppHandle) -> Result<String, String> {
    twitch_profiles::configured_client_id_for(app).await
}

async fn helix_credentials(app: &tauri::AppHandle) -> Result<(String, String), String> {
    twitch_profiles::resolve_helix_credentials(app).await
}

pub(crate) async fn app_access_token(app: &tauri::AppHandle) -> Result<String, String> {
    let (client_id, client_secret) = helix_credentials(app).await?;
    let cache = APP_TOKEN.get_or_init(|| Mutex::new(None));
    let mut cached = cache.lock().await;
    if let Some(token) = cached.as_ref() {
        if token.expires_at > chrono::Utc::now().timestamp() + 120 {
            return Ok(token.access_token.clone());
        }
    }

    let response = reqwest::Client::new()
        .post("https://id.twitch.tv/oauth2/token")
        .form(&[
            ("client_id", client_id.as_str()),
            ("client_secret", client_secret.as_str()),
            ("grant_type", "client_credentials"),
        ])
        .send()
        .await
        .map_err(|error| {
            tracing::warn!(%error, "Error contactando Twitch para token de app");
            "No se pudo conectar con Twitch. Revisa tu conexión.".to_string()
        })?;
    if !response.status().is_success() {
        tracing::warn!(status = %response.status(), "Twitch rechazó credenciales de app");
        return Err("Twitch rechazó las credenciales de la aplicación.".into());
    }
    let body: TokenResponse = response.json().await.map_err(|error| error.to_string())?;
    *cached = Some(AppAccessToken {
        access_token: body.access_token.clone(),
        expires_at: chrono::Utc::now().timestamp() + body.expires_in,
    });
    Ok(body.access_token)
}

fn credential() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, ACCOUNT).map_err(|error| error.to_string())
}

fn read_tokens() -> Result<StoredTokens, String> {
    let value = credential()?.get_password().map_err(|error| error.to_string())?;
    serde_json::from_str(&value).map_err(|error| error.to_string())
}

pub(crate) async fn valid_tokens() -> Result<StoredTokens, String> {
    let current = read_tokens()?;
    if current.expires_at > chrono::Utc::now().timestamp() + 120 {
        return Ok(current);
    }
    let client_secret =
        std::env::var("TWITCH_CLIENT_SECRET").map_err(|_| TWITCH_CONFIG_MISSING.to_string())?;
    let response = reqwest::Client::new().post("https://id.twitch.tv/oauth2/token").form(&[
        ("grant_type", "refresh_token"),
        ("refresh_token", current.refresh_token.as_str()),
        ("client_id", current.client_id.as_str()),
        ("client_secret", client_secret.as_str()),
    ]).send().await.map_err(|error| {
        tracing::warn!(%error, "Error renovando sesión Twitch");
        "No se pudo renovar la sesión de Twitch.".to_string()
    })?;
    if !response.status().is_success() {
        let body = response.text().await.unwrap_or_default();
        tracing::warn!(%body, "Twitch rechazó renovación de sesión");
        return Err("No fue posible renovar la sesión de Twitch. Vuelve a iniciar sesión.".into());
    }
    let body: TokenResponse = response.json().await.map_err(|error| error.to_string())?;
    let refreshed = StoredTokens {
        access_token: body.access_token,
        refresh_token: body.refresh_token,
        expires_at: chrono::Utc::now().timestamp() + body.expires_in,
        client_id: current.client_id,
        scopes: body.scope,
        login: current.login,
        display_name: current.display_name,
        avatar_url: current.avatar_url,
    };
    credential()?.set_password(&serde_json::to_string(&refreshed).map_err(|error| error.to_string())?)
        .map_err(|error| error.to_string())?;
    Ok(refreshed)
}

pub(crate) async fn fetch_user_profile(client_id: &str, access_token: &str) -> Result<(String, String, String, String), String> {
    let response = reqwest::Client::new()
        .get("https://api.twitch.tv/helix/users")
        .header("Client-Id", client_id)
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|error| {
            tracing::warn!(%error, "Error consultando perfil Twitch");
            "No se pudo consultar el perfil de Twitch.".to_string()
        })?;
    if !response.status().is_success() {
        tracing::warn!(status = %response.status(), "Twitch rechazó consulta de perfil");
        return Err("No se pudo obtener el perfil de Twitch.".into());
    }
    let body: HelixResponse<HelixUser> = response.json().await.map_err(|error| error.to_string())?;
    let user = body
        .data
        .into_iter()
        .next()
        .ok_or_else(|| "Twitch no devolvió datos del usuario autenticado".to_string())?;
    Ok((user.id, user.login, user.display_name, user.profile_image_url))
}

fn auth_state_from_tokens(tokens: &StoredTokens) -> TwitchAuthState {
    TwitchAuthState {
        connected: true,
        display_name: tokens.display_name.clone(),
        login: tokens.login.clone(),
        avatar_url: tokens.avatar_url.clone(),
        expires_at: Some(tokens.expires_at),
    }
}

async fn request_device_code(client_id: &str) -> Result<DeviceCodeResponse, String> {
    let response = reqwest::Client::new()
        .post("https://id.twitch.tv/oauth2/device")
        .form(&[("client_id", client_id), ("scopes", OAUTH_SCOPES)])
        .send()
        .await
        .map_err(|error| format!("No se pudo iniciar la autorización de Twitch: {error}"))?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!(
            "Twitch rechazó el inicio de autorización ({status}): {}",
            response.text().await.unwrap_or_default()
        ));
    }
    response
        .json()
        .await
        .map_err(|error| format!("Respuesta de autorización no válida: {error}"))
}

pub(crate) async fn store_oauth_tokens(
    client_id: String,
    body: TokenResponse,
    login: Option<String>,
    display_name: Option<String>,
    avatar_url: Option<String>,
) -> Result<StoredTokens, String> {
    let stored = StoredTokens {
        access_token: body.access_token,
        refresh_token: body.refresh_token,
        expires_at: chrono::Utc::now().timestamp() + body.expires_in,
        client_id,
        scopes: body.scope,
        login,
        display_name,
        avatar_url,
    };
    credential()?
        .set_password(&serde_json::to_string(&stored).map_err(|error| error.to_string())?)
        .map_err(|error| error.to_string())?;
    Ok(stored)
}

#[tauri::command]
pub async fn init_twitch_oauth(app: tauri::AppHandle) -> Result<TwitchDeviceCodeInfo, String> {
    let client_id = helix_client_id(&app).await?;
    let device = request_device_code(&client_id).await?;
    let pending = PendingDeviceFlow {
        device_code: device.device_code.clone(),
        client_id: client_id.clone(),
        expires_at: tokio::time::Instant::now() + Duration::from_secs(device.expires_in),
        interval: device.interval.max(1),
    };
    let slot = PENDING_DEVICE.get_or_init(|| Mutex::new(None));
    *slot.lock().await = Some(pending);
    Ok(TwitchDeviceCodeInfo {
        user_code: device.user_code,
        verification_uri: device.verification_uri,
        expires_in: device.expires_in,
        interval: device.interval.max(1),
    })
}

#[tauri::command]
pub async fn poll_twitch_oauth() -> Result<TwitchUserProfile, String> {
    let slot = PENDING_DEVICE.get_or_init(|| Mutex::new(None));
    let pending = slot
        .lock()
        .await
        .take()
        .ok_or_else(|| "No hay una autorización de Twitch en curso. Vuelve a iniciar sesión.".to_string())?;

    let client = reqwest::Client::new();
    let poll_interval = Duration::from_secs(pending.interval);
    loop {
        if tokio::time::Instant::now() >= pending.expires_at {
            return Err("El código de autorización de Twitch expiró; vuelve a intentarlo".into());
        }
        tokio::time::sleep(poll_interval).await;
        let token_response = client
            .post("https://id.twitch.tv/oauth2/token")
            .form(&[
                ("client_id", pending.client_id.as_str()),
                ("scope", OAUTH_SCOPES),
                ("device_code", pending.device_code.as_str()),
                ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
            ])
            .send()
            .await
            .map_err(|error| format!("No se pudo consultar la autorización de Twitch: {error}"))?;

        if token_response.status().is_success() {
            let body: TokenResponse = token_response
                .json()
                .await
                .map_err(|error| format!("Respuesta de token inválida: {error}"))?;
            let (_, login, display_name, avatar_url) =
                fetch_user_profile(&pending.client_id, &body.access_token).await?;
            let stored = store_oauth_tokens(
                pending.client_id,
                body,
                Some(login.clone()),
                Some(display_name.clone()),
                Some(avatar_url.clone()),
            )
            .await?;
            return Ok(TwitchUserProfile {
                login,
                display_name,
                avatar_url,
                expires_at: stored.expires_at,
            });
        }

        let _status = token_response.status();
        let error: OAuthErrorResponse = token_response.json().await.unwrap_or(OAuthErrorResponse {
            message: "error_desconocido".into(),
        });
        if error.message == "authorization_pending" {
            continue;
        }
        return Err("Twitch rechazó la autorización. Vuelve a intentarlo.".into());
    }
}

#[tauri::command]
pub async fn start_twitch_oauth(app: tauri::AppHandle) -> Result<TwitchUserProfile, String> {
    let _ = init_twitch_oauth(app.clone()).await?;
    poll_twitch_oauth().await
}

#[tauri::command]
pub async fn twitch_auth_state() -> TwitchAuthState {
    match valid_tokens().await {
        Ok(tokens) => {
            if tokens.login.is_some() {
                auth_state_from_tokens(&tokens)
            } else {
                match fetch_user_profile(&tokens.client_id, &tokens.access_token).await {
                    Ok((_, login, display_name, avatar_url)) => {
                        let enriched = StoredTokens {
                            login: Some(login.clone()),
                            display_name: Some(display_name.clone()),
                            avatar_url: Some(avatar_url.clone()),
                            ..tokens
                        };
                        let _ = credential().and_then(|entry| {
                            entry
                                .set_password(
                                    &serde_json::to_string(&enriched).map_err(|error| error.to_string())?,
                                )
                                .map_err(|error| error.to_string())
                        });
                        auth_state_from_tokens(&enriched)
                    }
                    Err(_) => auth_state_from_tokens(&tokens),
                }
            }
        }
        Err(_) => TwitchAuthState {
            connected: false,
            display_name: None,
            login: None,
            avatar_url: None,
            expires_at: None,
        },
    }
}

#[tauri::command]
pub async fn store_twitch_oauth_tokens(
    app: tauri::AppHandle,
    access_token: String,
    refresh_token: String,
    expires_in: i64,
    login: String,
    display_name: String,
    avatar_url: String,
) -> Result<(), String> {
    let client_id = helix_client_id(&app).await?;
    store_oauth_tokens(
        client_id,
        TokenResponse {
            access_token,
            refresh_token,
            expires_in,
            scope: OAUTH_SCOPES
                .split(' ')
                .map(str::to_string)
                .collect(),
        },
        Some(login),
        Some(display_name),
        Some(avatar_url),
    )
    .await?;
    Ok(())
}

#[tauri::command]
pub fn disconnect_twitch() -> Result<(), String> {
    if let Some(slot) = PENDING_DEVICE.get() {
        if let Ok(mut pending) = slot.try_lock() {
            *pending = None;
        }
    }
    credential()?.delete_credential().map_err(|error| error.to_string())
}

/// Conteo público de seguidores por login (App Token → solo `total`).
async fn fetch_follower_totals(
    client: &reqwest::Client,
    client_id: &str,
    access_token: &str,
    users: &HashMap<String, HelixUser>,
) -> HashMap<String, u64> {
    let futures = users.iter().map(|(login, user)| {
        let client = client.clone();
        let client_id = client_id.to_string();
        let access_token = access_token.to_string();
        let login = login.clone();
        let broadcaster_id = user.id.clone();
        async move {
            let mut url = match url::Url::parse("https://api.twitch.tv/helix/channels/followers") {
                Ok(u) => u,
                Err(_) => return (login, None),
            };
            url.query_pairs_mut()
                .append_pair("broadcaster_id", &broadcaster_id)
                .append_pair("first", "1");
            let total = match client
                .get(url)
                .header("Client-Id", &client_id)
                .bearer_auth(&access_token)
                .send()
                .await
            {
                Ok(response) if response.status().is_success() => {
                    match response.json::<HelixChannelFollowers>().await {
                        Ok(body) => Some(body.total),
                        Err(error) => {
                            tracing::warn!(%error, %login, "No se pudo parsear followers del canal");
                            None
                        }
                    }
                }
                Ok(response) => {
                    tracing::warn!(
                        status = %response.status(),
                        %login,
                        "Twitch rechazó consulta de followers"
                    );
                    None
                }
                Err(error) => {
                    tracing::warn!(%error, %login, "Error consultando followers del canal");
                    None
                }
            };
            (login, total)
        }
    });

    let mut totals = HashMap::new();
    for (login, total) in futures_util::future::join_all(futures).await {
        if let Some(count) = total {
            totals.insert(login, count);
        }
    }
    totals
}

#[tauri::command]
pub async fn refresh_talents(app: tauri::AppHandle) -> Result<Vec<TalentSnapshot>, String> {
    use tauri::Manager;

    let client_id = helix_client_id(&app).await?;
    let access_token = app_access_token(&app).await?;
    let client = reqwest::Client::new();

    let app_dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
    let db_path = app_dir.join("neuragest.db");
    let previous: Option<Vec<TalentSnapshot>> =
        crate::db::read_cache(&db_path, "twitch-talents").ok().flatten();
    let previous_followers: HashMap<String, u64> = previous
        .as_ref()
        .map(|rows| {
            rows.iter()
                .filter(|row| row.followers > 0)
                .map(|row| (row.login.to_lowercase(), row.followers))
                .collect()
        })
        .unwrap_or_default();

    let mut users_url = url::Url::parse("https://api.twitch.tv/helix/users").map_err(|error| error.to_string())?;
    for login in TALENTS { users_url.query_pairs_mut().append_pair("login", login); }
    let users_response = client.get(users_url)
        .header("Client-Id", &client_id).bearer_auth(&access_token)
        .send().await.map_err(|error| {
            tracing::warn!(%error, "Error consultando perfiles Twitch");
            "No se pudo consultar perfiles de Twitch.".to_string()
        })?;
    if !users_response.status().is_success() {
        tracing::warn!(status = %users_response.status(), "Twitch rechazó consulta de perfiles");
        return Err("No se pudo obtener el perfil de Twitch.".into());
    }
    let users: HelixResponse<HelixUser> = users_response.json().await.map_err(|error| error.to_string())?;

    let mut streams_url = url::Url::parse("https://api.twitch.tv/helix/streams").map_err(|error| error.to_string())?;
    for login in TALENTS { streams_url.query_pairs_mut().append_pair("user_login", login); }
    let streams_response = client.get(streams_url)
        .header("Client-Id", &client_id).bearer_auth(&access_token)
        .send().await.map_err(|error| {
            tracing::warn!(%error, "Error consultando transmisiones en vivo");
            "No se pudo consultar transmisiones en vivo.".to_string()
        })?;
    if !streams_response.status().is_success() {
        tracing::warn!(status = %streams_response.status(), "Twitch rechazó consulta de streams");
        return Err("No se pudo consultar el estado en vivo de Twitch.".into());
    }
    let streams: HelixResponse<HelixStream> = streams_response.json().await.map_err(|error| error.to_string())?;
    let live_by_login: HashMap<String, HelixStream> = streams.data.into_iter()
        .map(|stream| (stream.user_login.to_lowercase(), stream))
        .collect();

    let users_by_login: HashMap<String, HelixUser> = users.data.into_iter()
        .map(|user| (user.login.to_lowercase(), user))
        .collect();
    let followers_by_login =
        fetch_follower_totals(&client, &client_id, &access_token, &users_by_login).await;

    let snapshots: Vec<TalentSnapshot> = TALENTS.iter().filter_map(|login| {
        let user = users_by_login.get(*login)?;
        let stream = live_by_login.get(*login);
        let followers = followers_by_login
            .get(*login)
            .copied()
            .or_else(|| previous_followers.get(*login).copied())
            .unwrap_or(0);
        Some(TalentSnapshot {
            id: user.id.clone(),
            login: user.login.clone(),
            display_name: if user.login.eq_ignore_ascii_case("nosomevt") { "Nosome".into() } else { user.display_name.clone() },
            avatar: user.profile_image_url.clone(),
            description: user.description.clone(),
            is_live: stream.is_some(),
            viewers: stream.map_or(0, |value| value.viewer_count),
            followers,
            category: stream.map_or_else(|| "Offline".into(), |value| value.game_name.clone()),
            title: stream.map_or_else(String::new, |value| value.title.clone()),
            created_at: user.created_at.clone(),
            stream_id: stream.map(|value| value.id.clone()),
            started_at: stream.map(|value| value.started_at.clone()),
            offline_image_url: user.offline_image_url.clone(),
        })
    }).collect();

    crate::db::save_cache(&db_path, "twitch-talents", "talents", &snapshots)?;

    if let Some(prev) = previous.as_ref() {
        if let Err(error) = crate::twitch::metrics::sync_stream_events_from_helix(prev, &snapshots).await {
            tracing::warn!(%error, "No se pudieron sincronizar stream_events desde Helix");
        }
    }

    match crate::twitch::metrics::persist_metric_snapshots(&snapshots).await {
        Ok(count) => tracing::info!(count, "metric_snapshots persistidos en Supabase"),
        Err(error) => tracing::warn!(%error, "No se pudieron persistir metric_snapshots"),
    }

    if let Err(error) = crate::twitch::metrics::persist_clips_from_helix(&client_id, &access_token).await {
        tracing::warn!(%error, "No se pudieron sincronizar clips Helix → Supabase");
    }

    Ok(snapshots)
}

#[tauri::command]
pub async fn fetch_metric_snapshots(
    hours: Option<u32>,
    login: Option<String>,
) -> Result<Vec<crate::twitch::metrics::MetricSnapshotRow>, String> {
    crate::twitch::metrics::fetch_metric_snapshots(hours.unwrap_or(168), login.as_deref()).await
}

#[tauri::command]
pub async fn fetch_stream_events(
    hours: Option<u32>,
    login: Option<String>,
) -> Result<Vec<serde_json::Value>, String> {
    crate::twitch::metrics::fetch_stream_events(hours.unwrap_or(168), login.as_deref()).await
}

#[tauri::command]
pub async fn eventsub_status() -> Result<crate::twitch::eventsub::EventSubStatus, String> {
    Ok(crate::twitch::eventsub::eventsub_status().await)
}

#[derive(Debug, Deserialize, Serialize)]
struct HelixClip {
    id: String,
    url: String,
    broadcaster_id: String,
    broadcaster_name: String,
    creator_name: String,
    video_id: String,
    game_id: String,
    title: String,
    view_count: u64,
    created_at: String,
    thumbnail_url: String,
    duration: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WeeklyClipRow {
    pub id: String,
    pub url: String,
    pub login: String,
    pub display_name: String,
    pub title: String,
    pub view_count: u64,
    pub created_at: String,
    pub thumbnail_url: String,
    pub duration: f64,
    pub game_id: String,
}

#[tauri::command]
pub async fn fetch_weekly_clips(app: tauri::AppHandle) -> Result<Vec<WeeklyClipRow>, String> {
    let client_id = helix_client_id(&app).await?;
    let access_token = app_access_token(&app).await?;
    let client = reqwest::Client::new();

    let mut users_url =
        url::Url::parse("https://api.twitch.tv/helix/users").map_err(|error| error.to_string())?;
    for login in TALENTS {
        users_url.query_pairs_mut().append_pair("login", login);
    }
    let users_response = client
        .get(users_url)
        .header("Client-Id", &client_id)
        .bearer_auth(&access_token)
        .send()
        .await
        .map_err(|error| {
            tracing::warn!(%error, "Error consultando perfiles para clips");
            "No se pudo consultar perfiles de Twitch.".to_string()
        })?;
    if !users_response.status().is_success() {
        tracing::warn!(status = %users_response.status(), "Twitch rechazó consulta de perfiles para clips");
        return Err("No se pudo obtener el perfil de Twitch.".into());
    }
    let users: HelixResponse<HelixUser> = users_response
        .json()
        .await
        .map_err(|error| error.to_string())?;

    let started_at = (chrono::Utc::now() - chrono::Duration::days(7)).to_rfc3339();
    let mut clips: Vec<WeeklyClipRow> = Vec::new();

    for user in users.data {
        let mut clips_url =
            url::Url::parse("https://api.twitch.tv/helix/clips").map_err(|e| e.to_string())?;
        clips_url
            .query_pairs_mut()
            .append_pair("broadcaster_id", &user.id)
            .append_pair("started_at", &started_at)
            .append_pair("first", "20");
        let response = client
            .get(clips_url)
            .header("Client-Id", &client_id)
            .bearer_auth(&access_token)
            .send()
            .await
            .map_err(|error| {
                tracing::warn!(%error, "Error obteniendo clips");
                "No se pudieron obtener clips de Twitch.".to_string()
            })?;
        if !response.status().is_success() {
            tracing::warn!(
                login = %user.login,
                status = %response.status(),
                "Helix clips falló para un talento"
            );
            continue;
        }
        let body: HelixResponse<HelixClip> = response
            .json()
            .await
            .map_err(|error| error.to_string())?;
        for clip in body.data {
            clips.push(WeeklyClipRow {
                id: clip.id,
                url: clip.url,
                login: user.login.clone(),
                display_name: user.display_name.clone(),
                title: clip.title,
                view_count: clip.view_count,
                created_at: clip.created_at,
                thumbnail_url: clip.thumbnail_url,
                duration: clip.duration,
                game_id: clip.game_id,
            });
        }
    }

    clips.sort_by(|a, b| b.view_count.cmp(&a.view_count));
    Ok(clips)
}

#[derive(Debug, Deserialize)]
struct HelixVideo {
    id: String,
    #[serde(rename = "user_id")]
    _user_id: String,
    #[serde(rename = "user_login")]
    _user_login: String,
    #[serde(rename = "user_name")]
    _user_name: String,
    title: String,
    url: String,
    thumbnail_url: String,
    view_count: u64,
    published_at: String,
    duration: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WeeklyVodRow {
    pub id: String,
    pub url: String,
    pub login: String,
    pub display_name: String,
    pub title: String,
    pub view_count: u64,
    pub published_at: String,
    pub thumbnail_url: String,
    pub duration_seconds: u64,
    pub duration_label: String,
}

fn parse_duration_seconds(label: &str) -> u64 {
    let mut total: u64 = 0;
    let mut num = String::new();
    for ch in label.chars() {
        if ch.is_ascii_digit() {
            num.push(ch);
        } else if !num.is_empty() {
            let value: u64 = num.parse().unwrap_or(0);
            num.clear();
            match ch {
                'h' => total += value * 3600,
                'm' => total += value * 60,
                's' => total += value,
                _ => {}
            }
        }
    }
    total
}

#[tauri::command]
pub async fn fetch_weekly_vods(app: tauri::AppHandle) -> Result<Vec<WeeklyVodRow>, String> {
    let client_id = helix_client_id(&app).await?;
    let access_token = app_access_token(&app).await?;
    let client = reqwest::Client::new();

    let mut users_url =
        url::Url::parse("https://api.twitch.tv/helix/users").map_err(|error| error.to_string())?;
    for login in TALENTS {
        users_url.query_pairs_mut().append_pair("login", login);
    }
    let users_response = client
        .get(users_url)
        .header("Client-Id", &client_id)
        .bearer_auth(&access_token)
        .send()
        .await
        .map_err(|error| {
            tracing::warn!(%error, "Error consultando perfiles para VODs");
            "No se pudo consultar perfiles de Twitch.".to_string()
        })?;
    if !users_response.status().is_success() {
        tracing::warn!(status = %users_response.status(), "Twitch rechazó consulta de perfiles para VODs");
        return Err("No se pudo obtener el perfil de Twitch.".into());
    }
    let users: HelixResponse<HelixUser> = users_response
        .json()
        .await
        .map_err(|error| error.to_string())?;

    let week_ago = chrono::Utc::now() - chrono::Duration::days(7);
    let mut vods: Vec<WeeklyVodRow> = Vec::new();

    for user in users.data {
        let mut videos_url =
            url::Url::parse("https://api.twitch.tv/helix/videos").map_err(|e| e.to_string())?;
        videos_url
            .query_pairs_mut()
            .append_pair("user_id", &user.id)
            .append_pair("type", "archive")
            .append_pair("first", "20");
        let response = client
            .get(videos_url)
            .header("Client-Id", &client_id)
            .bearer_auth(&access_token)
            .send()
            .await
            .map_err(|error| {
                tracing::warn!(%error, "Error obteniendo VODs");
                "No se pudieron obtener VODs de Twitch.".to_string()
            })?;
        if !response.status().is_success() {
            tracing::warn!(
                login = %user.login,
                status = %response.status(),
                "Helix videos falló para un talento"
            );
            continue;
        }
        let body: HelixResponse<HelixVideo> = response
            .json()
            .await
            .map_err(|error| error.to_string())?;
        for video in body.data {
            let published = chrono::DateTime::parse_from_rfc3339(&video.published_at)
                .map(|dt| dt.with_timezone(&chrono::Utc))
                .unwrap_or_else(|_| chrono::Utc::now());
            if published < week_ago {
                continue;
            }
            vods.push(WeeklyVodRow {
                id: video.id,
                url: video.url,
                login: user.login.clone(),
                display_name: user.display_name.clone(),
                title: video.title,
                view_count: video.view_count,
                published_at: video.published_at,
                thumbnail_url: video.thumbnail_url,
                duration_seconds: parse_duration_seconds(&video.duration),
                duration_label: video.duration,
            });
        }
    }

    vods.sort_by(|a, b| b.view_count.cmp(&a.view_count));
    Ok(vods)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackfillResult {
    pub metrics_snapshots: usize,
    pub clips_persisted: usize,
    pub days: u32,
    pub note: String,
}

async fn fetch_clips_for_days(
    app: &tauri::AppHandle,
    days: u32,
) -> Result<Vec<crate::twitch::metrics::ClipInsert>, String> {
    let client_id = helix_client_id(app).await?;
    let access_token = app_access_token(app).await?;
    let client = reqwest::Client::new();

    let mut users_url =
        url::Url::parse("https://api.twitch.tv/helix/users").map_err(|error| error.to_string())?;
    for login in TALENTS {
        users_url.query_pairs_mut().append_pair("login", login);
    }
    let users_response = client
        .get(users_url)
        .header("Client-Id", &client_id)
        .bearer_auth(&access_token)
        .send()
        .await
        .map_err(|error| {
            tracing::warn!(%error, "Error consultando perfiles para relleno");
            "No se pudo consultar perfiles de Twitch.".to_string()
        })?;
    if !users_response.status().is_success() {
        tracing::warn!(status = %users_response.status(), "Twitch rechazó consulta de perfiles para relleno");
        return Err("No se pudo obtener el perfil de Twitch.".into());
    }
    let users: HelixResponse<HelixUser> = users_response
        .json()
        .await
        .map_err(|error| error.to_string())?;

    let started_at = (chrono::Utc::now() - chrono::Duration::days(days as i64)).to_rfc3339();
    let mut clip_inserts: Vec<crate::twitch::metrics::ClipInsert> = Vec::new();

    for user in users.data {
        let mut clips_url =
            url::Url::parse("https://api.twitch.tv/helix/clips").map_err(|e| e.to_string())?;
        clips_url
            .query_pairs_mut()
            .append_pair("broadcaster_id", &user.id)
            .append_pair("started_at", &started_at)
            .append_pair("first", "100");
        let response = client
            .get(clips_url)
            .header("Client-Id", &client_id)
            .bearer_auth(&access_token)
            .send()
            .await
            .map_err(|error| {
                tracing::warn!(%error, "Error obteniendo clips para relleno");
                "No se pudieron obtener clips de Twitch.".to_string()
            })?;
        if !response.status().is_success() {
            tracing::warn!(
                login = %user.login,
                status = %response.status(),
                "Helix clips backfill falló para un talento"
            );
            continue;
        }
        let body: HelixResponse<HelixClip> = response
            .json()
            .await
            .map_err(|error| error.to_string())?;
        for clip in body.data {
            clip_inserts.push(crate::twitch::metrics::ClipInsert {
                twitch_clip_id: clip.id,
                login: user.login.clone(),
                title: clip.title,
                url: clip.url,
                thumbnail_url: clip.thumbnail_url,
                view_count: clip.view_count,
                published_at: clip.created_at,
            });
        }
    }

    Ok(clip_inserts)
}

#[tauri::command]
pub async fn backfill_metrics_clips(
    app: tauri::AppHandle,
    days: Option<u32>,
) -> Result<BackfillResult, String> {
    let window_days = days.unwrap_or(30).clamp(1, 90);

    let snapshots = refresh_talents(app.clone()).await?;
    let metrics_count = crate::twitch::metrics::persist_metric_snapshots(&snapshots)
        .await
        .unwrap_or(0);

    let clip_rows = fetch_clips_for_days(&app, window_days).await?;
    let clips_count = crate::twitch::metrics::persist_clips(&clip_rows).await?;

    Ok(BackfillResult {
        metrics_snapshots: metrics_count,
        clips_persisted: clips_count,
        days: window_days,
        note: format!(
            "Estado actual de {} talentos y {} clips (últimos {} días). \
             Twitch no guarda histórico de espectadores; el relleno captura el estado en vivo al ejecutar.",
            snapshots.len(),
            clips_count,
            window_days
        ),
    })
}

#[tauri::command]
pub fn cached_talents(app: tauri::AppHandle) -> Result<Option<Vec<TalentSnapshot>>, String> {
    use tauri::Manager;

    let app_dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
    crate::db::read_cache(&app_dir.join("neuragest.db"), "twitch-talents")
}

#[tauri::command]
pub async fn sync_twitchtracker(app: tauri::AppHandle) -> Result<crate::twitch::twitchtracker::TwitchTrackerSyncResult, String> {
    use tauri::Manager;

    let result = crate::twitch::twitchtracker::sync_all_talents().await?;
    let app_dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
    crate::twitch::twitchtracker::persist_sync_status_cache(&app_dir, &result).await;
    Ok(result)
}

#[tauri::command]
pub async fn fetch_twitchtracker_snapshots(
    hours: Option<u32>,
) -> Result<Vec<crate::twitch::twitchtracker::TwitchTrackerSnapshotRow>, String> {
    crate::twitch::twitchtracker::fetch_snapshots(hours.unwrap_or(720)).await
}

#[tauri::command]
pub async fn twitchtracker_sync_status(
    app: tauri::AppHandle,
) -> Result<crate::twitch::twitchtracker::TwitchTrackerSyncStatus, String> {
    use tauri::Manager;

    let mut status = crate::twitch::twitchtracker::fetch_sync_status().await?;
    let app_dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
    if let Some(cached) = crate::twitch::twitchtracker::read_sync_status_cache(&app_dir) {
        status.last_error_count = cached.errors.len() as u32;
        status.last_errors = cached.errors;
        if status.last_sync_at.is_none() {
            status.last_sync_at = Some(cached.last_sync_at);
        }
        if status.last_synced_count == 0 {
            status.last_synced_count = cached.synced;
        }
    }
    Ok(status)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectMetricsResult {
    pub login: Option<String>,
    pub snapshots_written: usize,
    pub vods_synced: usize,
    pub tt_synced: u32,
    pub tt_errors: Vec<String>,
    pub stream_events_synced: u32,
    pub collected_at: String,
    pub note: String,
}

async fn sync_vods_from_helix(
    app: &tauri::AppHandle,
    days: u32,
    login_filter: Option<&str>,
) -> Result<usize, String> {
    let client_id = helix_client_id(app).await?;
    let access_token = app_access_token(app).await?;
    let client = reqwest::Client::new();

    let mut users_url =
        url::Url::parse("https://api.twitch.tv/helix/users").map_err(|error| error.to_string())?;
    let logins: Vec<&str> = if let Some(login) = login_filter {
        vec![login]
    } else {
        TALENTS.to_vec()
    };
    for login in &logins {
        users_url.query_pairs_mut().append_pair("login", login);
    }
    let users_response = client
        .get(users_url)
        .header("Client-Id", &client_id)
        .bearer_auth(&access_token)
        .send()
        .await
        .map_err(|error| {
            tracing::warn!(%error, "Error consultando perfiles para VODs");
            "No se pudo consultar perfiles de Twitch.".to_string()
        })?;
    if !users_response.status().is_success() {
        tracing::warn!(status = %users_response.status(), "Twitch rechazó consulta de perfiles para VODs");
        return Err("No se pudo obtener el perfil de Twitch.".into());
    }
    let users: HelixResponse<HelixUser> = users_response
        .json()
        .await
        .map_err(|error| error.to_string())?;

    let cutoff = chrono::Utc::now() - chrono::Duration::days(days as i64);
    let mut vod_inserts: Vec<crate::twitch::metrics::VodInsert> = Vec::new();

    for user in users.data {
        let mut videos_url =
            url::Url::parse("https://api.twitch.tv/helix/videos").map_err(|e| e.to_string())?;
        videos_url
            .query_pairs_mut()
            .append_pair("user_id", &user.id)
            .append_pair("type", "archive")
            .append_pair("period", "month")
            .append_pair("first", "100");
        let response = client
            .get(videos_url)
            .header("Client-Id", &client_id)
            .bearer_auth(&access_token)
            .send()
            .await
            .map_err(|error| {
                tracing::warn!(%error, "Error obteniendo VODs");
                "No se pudieron obtener VODs de Twitch.".to_string()
            })?;
        if !response.status().is_success() {
            tracing::warn!(
                login = %user.login,
                status = %response.status(),
                "Helix videos falló para un talento"
            );
            continue;
        }
        let body: HelixResponse<HelixVideo> = response
            .json()
            .await
            .map_err(|error| error.to_string())?;
        for video in body.data {
            let published = chrono::DateTime::parse_from_rfc3339(&video.published_at)
                .map(|dt| dt.with_timezone(&chrono::Utc))
                .unwrap_or_else(|_| chrono::Utc::now());
            if published < cutoff {
                continue;
            }
            vod_inserts.push(crate::twitch::metrics::VodInsert {
                twitch_video_id: video.id,
                login: user.login.clone(),
                title: video.title,
                url: video.url,
                duration_seconds: crate::twitch::metrics::parse_vod_duration_seconds(&video.duration),
                view_count: video.view_count,
                published_at: video.published_at,
            });
        }
    }

    crate::twitch::metrics::persist_vods(&vod_inserts).await
}

#[tauri::command]
pub async fn fetch_talent_vods(
    login: String,
    days: Option<u32>,
) -> Result<Vec<crate::twitch::metrics::TalentVodRow>, String> {
    let window_days = days.unwrap_or(30).clamp(1, 90);
    let hours = window_days * 24;
    crate::twitch::metrics::fetch_vods(hours, Some(login.as_str())).await
}

#[tauri::command]
pub async fn fetch_stream_sessions(
    hours: Option<u32>,
    login: Option<String>,
) -> Result<Vec<crate::twitch::metrics::StreamSessionRow>, String> {
    crate::twitch::metrics::fetch_stream_sessions(hours.unwrap_or(720), login.as_deref()).await
}

#[tauri::command]
pub async fn collect_talent_metrics(
    app: tauri::AppHandle,
    login: Option<String>,
) -> Result<CollectMetricsResult, String> {
    use tauri::Manager;

    let collected_at = chrono::Utc::now().to_rfc3339();
    let login_filter = login.as_deref();

    let snapshots = refresh_talents(app.clone()).await?;
    let snapshots_written = crate::twitch::metrics::persist_metric_snapshots(&snapshots)
        .await
        .unwrap_or(0);

    let vods_synced = sync_vods_from_helix(&app, 30, login_filter)
        .await
        .unwrap_or(0);

    let tt_result = crate::twitch::twitchtracker::sync_all_talents().await;
    let (tt_synced, tt_errors) = match tt_result {
        Ok(result) => {
            let app_dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
            crate::twitch::twitchtracker::persist_sync_status_cache(&app_dir, &result).await;
            (result.synced, result.errors)
        }
        Err(error) => (0, vec![error]),
    };

    let stream_events_synced = if let Some(target_login) = login_filter {
        crate::twitch::metrics::fetch_stream_events(720, Some(target_login))
            .await
            .map(|rows| rows.len() as u32)
            .unwrap_or(0)
    } else {
        crate::twitch::metrics::fetch_stream_events(720, None)
            .await
            .map(|rows| rows.len() as u32)
            .unwrap_or(0)
    };

    let note = format!(
        "Actualización Twitch: {} métricas, {} VODs (30 días), estadísticas externas ({} filas), \
         {} eventos de transmisión en ventana. El histórico de espectadores requiere monitoreo continuo; \
         las estadísticas externas aportan resumen de 30 días.",
        snapshots_written,
        vods_synced,
        tt_synced,
        stream_events_synced
    );

    Ok(CollectMetricsResult {
        login,
        snapshots_written,
        vods_synced,
        tt_synced,
        tt_errors,
        stream_events_synced,
        collected_at,
        note,
    })
}

/// Abre (o enfoca) una ventana WebView con twitch.tv/{login}.
/// Ahí el usuario puede iniciar sesión en Twitch; esa sesión sí puede contar view.
/// El iframe del mosaico (player.twitch.tv) no comparte esa sesión.
#[tauri::command]
pub async fn open_twitch_channel_window(
    app: tauri::AppHandle,
    login: String,
) -> Result<(), String> {
    use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

    let login = login.trim().to_lowercase();
    if login.is_empty()
        || login.len() > 25
        || !login
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_')
    {
        return Err("Canal de Twitch no válido".into());
    }

    let label = format!("twitch-viewer-{login}");
    let url_str = format!("https://www.twitch.tv/{login}");
    let parsed = url_str
        .parse::<url::Url>()
        .map_err(|e| format!("URL Twitch inválida: {e}"))?;

    if let Some(existing) = app.get_webview_window(&label) {
        let _ = existing.navigate(parsed.clone());
        let _ = existing.unminimize();
        let _ = existing.set_focus();
        return Ok(());
    }

    WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(parsed))
        .title(format!("Twitch · {login}"))
        .inner_size(1280.0, 800.0)
        .min_inner_size(640.0, 480.0)
        .focused(true)
        .build()
        .map_err(|e| format!("No se pudo abrir la ventana de Twitch: {e}"))?;

    Ok(())
}
