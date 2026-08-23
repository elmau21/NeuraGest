use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

use super::supabase_bridge::{supabase_json, supabase_request, DEFAULT_ORG_ID};

const SERVICE: &str = "com.neuralive.neuragest";
const ACCOUNT: &str = "google-calendar-oauth";
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const CALENDAR_SCOPE: &str = "https://www.googleapis.com/auth/calendar";

#[derive(Debug, Serialize, Deserialize)]
struct StoredGoogleTokens {
    access_token: String,
    refresh_token: String,
    expires_at: i64,
    email: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoogleOAuthStatus {
    pub connected: bool,
    pub email: Option<String>,
    pub expires_at: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoogleSyncResult {
    pub pulled: u32,
    pub pushed: u32,
    pub last_sync_at: String,
}

#[derive(Debug, Deserialize)]
struct GoogleTokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: i64,
}

#[derive(Debug, Deserialize)]
struct GoogleUserInfo {
    email: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GoogleEventsResponse {
    items: Option<Vec<GoogleEventItem>>,
}

#[derive(Debug, Deserialize)]
struct GoogleEventItem {
    id: String,
    summary: Option<String>,
    description: Option<String>,
    start: GoogleEventTime,
    end: GoogleEventTime,
}

#[derive(Debug, Deserialize)]
struct GoogleEventTime {
    date_time: Option<String>,
    date: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CalendarEventRow {
    id: String,
    title: String,
    description: Option<String>,
    #[serde(rename = "event_type")]
    _event_type: String,
    starts_at: String,
    ends_at: String,
    all_day: Option<bool>,
    external_calendar_id: Option<String>,
}

fn google_credential() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, ACCOUNT).map_err(|error| error.to_string())
}

fn read_tokens() -> Result<Option<StoredGoogleTokens>, String> {
    match google_credential()?.get_password() {
        Ok(raw) => serde_json::from_str(&raw)
            .map(Some)
            .map_err(|error| {
                tracing::warn!(%error, "Tokens Google inválidos en almacén");
                "La conexión con Google no es válida.".to_string()
            }),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

fn write_tokens(tokens: &StoredGoogleTokens) -> Result<(), String> {
    google_credential()?
        .set_password(&serde_json::to_string(tokens).map_err(|error| error.to_string())?)
        .map_err(|error| error.to_string())
}

fn configured_google_client() -> Result<(String, String), String> {
    const MSG: &str = "Falta la configuración de Google Calendar en esta instalación. Contacta al administrador o reinstala NeuraGest.";
    let client_id = std::env::var("GOOGLE_CLIENT_ID").map_err(|_| MSG.to_string())?;
    let client_secret = std::env::var("GOOGLE_CLIENT_SECRET").map_err(|_| MSG.to_string())?;
    Ok((client_id, client_secret))
}

async fn refresh_access_token(tokens: &StoredGoogleTokens) -> Result<StoredGoogleTokens, String> {
    let (client_id, client_secret) = configured_google_client()?;
    let response = reqwest::Client::new()
        .post(TOKEN_URL)
        .form(&[
            ("client_id", client_id.as_str()),
            ("client_secret", client_secret.as_str()),
            ("grant_type", "refresh_token"),
            ("refresh_token", tokens.refresh_token.as_str()),
        ])
        .send()
        .await
        .map_err(|error| {
            tracing::warn!(%error, "Error renovando token Google");
            "No se pudo renovar la conexión con Google.".to_string()
        })?;
    if !response.status().is_success() {
        let body = response.text().await.unwrap_or_default();
        tracing::warn!(%body, "Google rechazó renovación de token");
        return Err("No se pudo renovar la conexión con Google.".into());
    }
    let body: GoogleTokenResponse = response.json().await.map_err(|error| error.to_string())?;
    let refreshed = StoredGoogleTokens {
        access_token: body.access_token,
        refresh_token: body
            .refresh_token
            .unwrap_or_else(|| tokens.refresh_token.clone()),
        expires_at: chrono::Utc::now().timestamp() + body.expires_in,
        email: tokens.email.clone(),
    };
    write_tokens(&refreshed)?;
    Ok(refreshed)
}

async fn valid_access_token() -> Result<StoredGoogleTokens, String> {
    let tokens = read_tokens()?.ok_or_else(|| "Google Calendar no conectado.".to_string())?;
    if tokens.expires_at > chrono::Utc::now().timestamp() + 120 {
        return Ok(tokens);
    }
    refresh_access_token(&tokens).await
}

#[tauri::command]
pub async fn google_oauth_status() -> Result<GoogleOAuthStatus, String> {
    match read_tokens()? {
        Some(tokens) => Ok(GoogleOAuthStatus {
            connected: true,
            email: tokens.email,
            expires_at: Some(tokens.expires_at),
        }),
        None => Ok(GoogleOAuthStatus {
            connected: false,
            email: None,
            expires_at: None,
        }),
    }
}

#[tauri::command]
pub async fn google_oauth_begin(redirect_uri: String) -> Result<String, String> {
    let (client_id, _) = configured_google_client()?;
    let mut url = url::Url::parse(AUTH_URL).map_err(|error| error.to_string())?;
    url.query_pairs_mut()
        .append_pair("client_id", &client_id)
        .append_pair("redirect_uri", &redirect_uri)
        .append_pair("response_type", "code")
        .append_pair("scope", CALENDAR_SCOPE)
        .append_pair("access_type", "offline")
        .append_pair("prompt", "consent");
    Ok(url.to_string())
}

#[tauri::command]
pub async fn google_oauth_complete(callback_url: String, redirect_uri: String) -> Result<GoogleOAuthStatus, String> {
    let parsed = url::Url::parse(&callback_url).map_err(|error| error.to_string())?;
    let oauth_error = parsed
        .query_pairs()
        .find(|(key, _)| key == "error")
        .map(|(_, value)| value.to_string());
    if let Some(error) = oauth_error {
        return Err(format!("Google rechazó la conexión: {error}"));
    }
    let code = parsed
        .query_pairs()
        .find(|(key, _)| key == "code")
        .map(|(_, value)| value.to_string())
        .ok_or_else(|| "Google no devolvió el código de autorización.".to_string())?;

    let (client_id, client_secret) = configured_google_client()?;
    let response = reqwest::Client::new()
        .post(TOKEN_URL)
        .form(&[
            ("client_id", client_id.as_str()),
            ("client_secret", client_secret.as_str()),
            ("grant_type", "authorization_code"),
            ("code", code.as_str()),
            ("redirect_uri", redirect_uri.as_str()),
        ])
        .send()
        .await
        .map_err(|error| {
            tracing::warn!(%error, "Error intercambiando código Google");
            "No se pudo completar la conexión con Google.".to_string()
        })?;
    if !response.status().is_success() {
        let body = response.text().await.unwrap_or_default();
        tracing::warn!(%body, "Google rechazó intercambio de token");
        return Err("Google rechazó la conexión. Vuelve a intentarlo.".into());
    }
    let body: GoogleTokenResponse = response.json().await.map_err(|error| error.to_string())?;
    let refresh_token = body
        .refresh_token
        .ok_or_else(|| "Google no devolvió refresh_token. Revoca acceso previo e intenta de nuevo.".to_string())?;

    let user_response = reqwest::Client::new()
        .get("https://www.googleapis.com/oauth2/v2/userinfo")
        .bearer_auth(&body.access_token)
        .send()
        .await
        .map_err(|error| error.to_string())?;
    let email = if user_response.status().is_success() {
        user_response
            .json::<GoogleUserInfo>()
            .await
            .ok()
            .and_then(|info| info.email)
    } else {
        None
    };

    let stored = StoredGoogleTokens {
        access_token: body.access_token,
        refresh_token,
        expires_at: chrono::Utc::now().timestamp() + body.expires_in,
        email,
    };
    write_tokens(&stored)?;
    Ok(GoogleOAuthStatus {
        connected: true,
        email: stored.email,
        expires_at: Some(stored.expires_at),
    })
}

#[tauri::command]
pub async fn google_oauth_disconnect() -> Result<(), String> {
    match google_credential()?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

fn google_event_times(item: &GoogleEventItem) -> Option<(String, String, bool)> {
    if let Some(start) = &item.start.date_time {
        let end = item.end.date_time.as_ref()?.clone();
        return Some((start.clone(), end, false));
    }
    let start_date = item.start.date.as_ref()?;
    let end_date = item.end.date.as_ref()?;
    let starts_at = format!("{start_date}T00:00:00Z");
    let ends_at = format!("{end_date}T00:00:00Z");
    Some((starts_at, ends_at, true))
}

async fn list_local_calendar_events() -> Result<Vec<CalendarEventRow>, String> {
    let query = format!(
        "/rest/v1/calendar_events?select=id,title,description,event_type,starts_at,ends_at,all_day,external_calendar_id&organization_id=eq.{DEFAULT_ORG_ID}&deleted_at=is.null&order=starts_at.asc&limit=500"
    );
    let response = supabase_request(Method::GET, &query, None, None, &[]).await?;
    supabase_json(response, "No se pudieron leer calendar_events").await
}

async fn upsert_local_from_google(items: &[GoogleEventItem]) -> Result<u32, String> {
    let mut count = 0u32;
    for item in items {
        let Some((starts_at, ends_at, all_day)) = google_event_times(item) else {
            continue;
        };
        let payload = json!({
            "title": item.summary.clone().unwrap_or_else(|| "Evento Google".into()),
            "description": item.description,
            "event_type": "meeting",
            "starts_at": starts_at,
            "ends_at": ends_at,
            "all_day": all_day,
            "external_calendar_id": item.id,
        });
        let filter = format!("/rest/v1/calendar_events?external_calendar_id=eq.{}", item.id);
        let existing = supabase_request(Method::GET, &filter, None, None, &[]).await?;
        let exists = if existing.status().is_success() {
            let body = existing.text().await.unwrap_or_default();
            !body.trim().eq("[]")
        } else {
            false
        };
        let response = if exists {
            supabase_request(
                Method::PATCH,
                "/rest/v1/calendar_events",
                Some(&format!("?external_calendar_id=eq.{}", item.id)),
                Some(payload),
                &[("Prefer", "return=minimal")],
            )
            .await?
        } else {
            let mut insert = payload.as_object().cloned().unwrap_or_default();
            insert.insert("organization_id".into(), json!(DEFAULT_ORG_ID));
            supabase_request(
                Method::POST,
                "/rest/v1/calendar_events",
                None,
                Some(Value::Object(insert)),
                &[("Prefer", "return=minimal")],
            )
            .await?
        };
        if response.status().is_success() {
            count += 1;
        }
    }
    Ok(count)
}

async fn push_local_to_google(access_token: &str, calendar_id: &str, rows: &[CalendarEventRow]) -> Result<u32, String> {
    let client = reqwest::Client::new();
    let mut pushed = 0u32;
    for row in rows.iter().filter(|row| row.external_calendar_id.is_none()) {
        let body = json!({
            "summary": row.title,
            "description": row.description,
            "start": if row.all_day.unwrap_or(false) {
                json!({ "date": row.starts_at.split('T').next().unwrap_or(&row.starts_at) })
            } else {
                json!({ "dateTime": row.starts_at })
            },
            "end": if row.all_day.unwrap_or(false) {
                json!({ "date": row.ends_at.split('T').next().unwrap_or(&row.ends_at) })
            } else {
                json!({ "dateTime": row.ends_at })
            },
        });
        let url = format!(
            "https://www.googleapis.com/calendar/v3/calendars/{}/events",
            urlencoding(calendar_id)
        );
        let response = client
            .post(url)
            .bearer_auth(access_token)
            .json(&body)
            .send()
            .await
            .map_err(|error| error.to_string())?;
        if !response.status().is_success() {
            tracing::warn!(status = %response.status(), title = %row.title, "Push Google Calendar falló");
            continue;
        }
        let created: GoogleEventItem = response.json().await.map_err(|error| error.to_string())?;
        let patch = supabase_request(
            Method::PATCH,
            "/rest/v1/calendar_events",
            Some(&format!("?id=eq.{}", row.id)),
            Some(json!({ "external_calendar_id": created.id })),
            &[("Prefer", "return=minimal")],
        )
        .await?;
        if patch.status().is_success() {
            pushed += 1;
        }
    }
    Ok(pushed)
}

#[tauri::command]
pub async fn sync_google_calendar(calendar_id: Option<String>) -> Result<GoogleSyncResult, String> {
    let tokens = valid_access_token().await?;
    let calendar_id = calendar_id.unwrap_or_else(|| "primary".to_string());
    let time_min = (chrono::Utc::now() - chrono::Duration::days(30)).to_rfc3339();
    let time_max = (chrono::Utc::now() + chrono::Duration::days(90)).to_rfc3339();
    let list_url = format!(
        "https://www.googleapis.com/calendar/v3/calendars/{}/events?singleEvents=true&orderBy=startTime&timeMin={}&timeMax={}&maxResults=250",
        urlencoding(&calendar_id),
        urlencoding(&time_min),
        urlencoding(&time_max),
    );
    let response = reqwest::Client::builder()
        .timeout(Duration::from_secs(45))
        .build()
        .map_err(|error| error.to_string())?
        .get(list_url)
        .bearer_auth(&tokens.access_token)
        .send()
        .await
        .map_err(|error| {
            tracing::warn!(%error, "Error listando calendario Google");
            "No se pudo leer el calendario de Google.".to_string()
        })?;
    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        tracing::warn!(%status, %body, "Google Calendar respondió con error");
        return Err("No se pudo sincronizar con Google Calendar.".into());
    }
    let body: GoogleEventsResponse = response.json().await.map_err(|error| error.to_string())?;
    let items = body.items.unwrap_or_default();
    let pulled = upsert_local_from_google(&items).await?;
    let local = list_local_calendar_events().await?;
    let pushed = push_local_to_google(&tokens.access_token, &calendar_id, &local).await?;
    Ok(GoogleSyncResult {
        pulled,
        pushed,
        last_sync_at: chrono::Utc::now().to_rfc3339(),
    })
}

fn urlencoding(value: &str) -> String {
    url::form_urlencoded::byte_serialize(value.as_bytes()).collect()
}
