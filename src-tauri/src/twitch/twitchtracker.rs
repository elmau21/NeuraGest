use crate::commands::TALENTS;
use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

const DEFAULT_ORG_ID: &str = "00000000-0000-0000-0000-000000000001";
const API_BASE: &str = "https://twitchtracker.com/api";
const USER_AGENT: &str = "NeuraGest/1.0 (agency analytics; +https://github.com/neuralive/neuragest)";
const REQUEST_DELAY_MS: u64 = 600;

#[derive(Debug, Clone, Deserialize)]
struct ChannelSummaryResponse {
    rank: Option<i64>,
    minutes_streamed: Option<i64>,
    avg_viewers: Option<i64>,
    max_viewers: Option<i64>,
    hours_watched: Option<i64>,
    followers: Option<i64>,
    followers_total: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct TalentIdRow {
    id: String,
    login: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TwitchTrackerSnapshotRow {
    pub id: i64,
    pub talent_id: String,
    pub login: String,
    pub period_days: i32,
    pub rank: Option<i32>,
    pub avg_viewers: i32,
    pub max_viewers: i32,
    pub minutes_streamed: i32,
    pub hours_watched: i32,
    pub followers_growth: Option<i32>,
    pub followers_total: Option<i32>,
    pub synced_at: String,
}

#[derive(Debug, Deserialize)]
struct TwitchTrackerSnapshotDbRow {
    id: i64,
    talent_id: String,
    login: String,
    period_days: i32,
    rank: Option<i32>,
    avg_viewers: i32,
    max_viewers: i32,
    minutes_streamed: i32,
    hours_watched: i32,
    followers_growth: Option<i32>,
    followers_total: Option<i32>,
    synced_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TwitchTrackerSyncStatus {
    pub last_sync_at: Option<String>,
    pub last_synced_count: u32,
    pub last_error_count: u32,
    pub last_errors: Vec<String>,
    pub total_snapshots: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TwitchTrackerSyncResult {
    pub synced: u32,
    pub skipped: u32,
    pub errors: Vec<String>,
    pub synced_at: String,
    pub note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CachedSyncStatus {
    pub last_sync_at: String,
    pub synced: u32,
    pub skipped: u32,
    pub errors: Vec<String>,
}

fn supabase_config() -> Result<(String, String), String> {
    let url = std::env::var("SUPABASE_URL")
        .or_else(|_| std::env::var("VITE_SUPABASE_URL"))
        .map_err(|_| "La conexión con la nube no está configurada.".to_string())?;
    let key = std::env::var("SUPABASE_SERVICE_ROLE_KEY")
        .map_err(|_| "Falta la clave de servicio de la nube.".to_string())?;
    Ok((url, key))
}

async fn supabase_request(
    method: Method,
    path: &str,
    query: Option<&str>,
    body: Option<Value>,
    extra_headers: &[(&str, &str)],
) -> Result<reqwest::Response, String> {
    let (base, key) = supabase_config()?;
    let url = format!(
        "{}{}{}",
        base.trim_end_matches('/'),
        path,
        query.unwrap_or("")
    );
    let mut request = reqwest::Client::new()
        .request(method, url)
        .header("apikey", &key)
        .header("Authorization", format!("Bearer {key}"))
        .header("Content-Type", "application/json");
    for (name, value) in extra_headers {
        request = request.header(*name, *value);
    }
    if let Some(payload) = body {
        request = request.json(&payload);
    }
    request
        .send()
        .await
        .map_err(|error| {
            tracing::warn!(%error, "Falló petición a la nube");
            "No se pudo conectar con la nube NeuraGest.".to_string()
        })
}

async fn fetch_talent_ids_by_login(
    logins: &[&str],
) -> Result<std::collections::HashMap<String, String>, String> {
    if logins.is_empty() {
        return Ok(std::collections::HashMap::new());
    }
    let ids = logins.join(",");
    let query = format!(
        "/rest/v1/talents?select=id,login&organization_id=eq.{DEFAULT_ORG_ID}&login=in.({ids})"
    );
    let response = supabase_request(Method::GET, &query, None, None, &[]).await?;
    let status = response.status();
    let body = response.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        tracing::warn!(%status, %body, "No se pudieron leer talentos");
        return Err("No se pudieron leer los talentos.".into());
    }
    let rows: Vec<TalentIdRow> =
        serde_json::from_str(&body).map_err(|e| {
            tracing::warn!(%e, "Respuesta de talentos no interpretable");
            "No se pudieron interpretar los datos de talentos.".to_string()
        })?;
    Ok(rows
        .into_iter()
        .map(|row| (row.login.to_lowercase(), row.id))
        .collect())
}

fn build_client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .timeout(Duration::from_secs(20))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
}

async fn fetch_channel_summary(login: &str) -> Result<(ChannelSummaryResponse, Value), String> {
    let client = build_client();
    let url = format!("{API_BASE}/channels/summary/{login}");
    let mut request = client.get(&url);
    if let Ok(api_key) = std::env::var("TWITCHTRACKER_API_KEY") {
        if !api_key.trim().is_empty() {
            request = request.header("Authorization", format!("Bearer {}", api_key.trim()));
        }
    }

    let response = request
        .send()
        .await
        .map_err(|error| {
            tracing::warn!(%login, %error, "Error consultando estadísticas externas");
            format!("No se pudo consultar estadísticas para {login}.")
        })?;
    let status = response.status();
    let body = response.text().await.map_err(|e| e.to_string())?;

    if status.as_u16() == 403 {
        tracing::warn!(%login, "Estadísticas externas rechazaron la consulta (403)");
        return Err(format!(
            "No se pudo consultar estadísticas para {login}. El servicio rechazó la petición."
        ));
    }
    if !status.is_success() {
        tracing::warn!(%login, %status, %body, "Estadísticas externas respondieron con error");
        return Err(format!("No se pudo consultar estadísticas para {login}."));
    }

    let raw: Value = serde_json::from_str(&body)
        .map_err(|e| {
            tracing::warn!(%login, %e, "Respuesta de estadísticas no interpretable");
            format!("No se pudieron interpretar estadísticas para {login}.")
        })?;
    let parsed: ChannelSummaryResponse = serde_json::from_value(raw.clone())
        .map_err(|e| {
            tracing::warn!(%login, %e, "Formato de estadísticas inesperado");
            format!("Formato de estadísticas inesperado para {login}.")
        })?;

    let has_metrics = parsed.rank.is_some()
        || parsed.avg_viewers.unwrap_or(0) > 0
        || parsed.max_viewers.unwrap_or(0) > 0
        || parsed.minutes_streamed.unwrap_or(0) > 0;
    if !has_metrics {
        return Err(format!(
            "No hay resumen de estadísticas para «{login}». Verifica el nombre exacto del canal."
        ));
    }

    Ok((parsed, raw))
}

pub async fn sync_all_talents() -> Result<TwitchTrackerSyncResult, String> {
    let synced_at = chrono::Utc::now().to_rfc3339();
    let id_by_login = fetch_talent_ids_by_login(&TALENTS).await?;
    let mut upserts: Vec<Value> = Vec::new();
    let mut errors: Vec<String> = Vec::new();
    let mut skipped = 0u32;

    for (index, login) in TALENTS.iter().enumerate() {
        if index > 0 {
            tokio::time::sleep(Duration::from_millis(REQUEST_DELAY_MS)).await;
        }

        let talent_id = match id_by_login.get(&login.to_lowercase()) {
            Some(id) => id.clone(),
            None => {
                skipped += 1;
                errors.push(format!("{login}: talento no encontrado en la base de datos"));
                continue;
            }
        };

        match fetch_channel_summary(login).await {
            Ok((summary, raw)) => {
                let sync_date = chrono::Utc::now().format("%Y-%m-%d").to_string();
                upserts.push(json!({
                    "organization_id": DEFAULT_ORG_ID,
                    "talent_id": talent_id,
                    "login": login,
                    "period_days": 30,
                    "rank": summary.rank,
                    "avg_viewers": summary.avg_viewers.unwrap_or(0),
                    "max_viewers": summary.max_viewers.unwrap_or(0),
                    "minutes_streamed": summary.minutes_streamed.unwrap_or(0),
                    "hours_watched": summary.hours_watched.unwrap_or(0),
                    "followers_growth": summary.followers,
                    "followers_total": summary.followers_total,
                    "raw_payload": raw,
                    "sync_date": sync_date,
                    "synced_at": synced_at,
                }));
            }
            Err(error) => {
                errors.push(error);
            }
        }
    }

    let synced = if upserts.is_empty() {
        0
    } else {
        let count = upserts.len() as u32;
        let response = supabase_request(
            Method::POST,
            "/rest/v1/twitchtracker_snapshots",
            Some("?on_conflict=organization_id,talent_id,sync_date"),
            Some(Value::Array(upserts)),
            &[("Prefer", "resolution=merge-duplicates,return=minimal")],
        )
        .await?;
        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            tracing::warn!(%status, %body, "No se pudieron guardar estadísticas externas");
            return Err("No se pudieron guardar las estadísticas externas.".into());
        }
        count
    };

    let note = format!(
        "Resumen de 30 días por talento desde estadísticas externas. \
         {synced} guardados, {skipped} omitidos, {} con avisos.",
        errors.len()
    );

    Ok(TwitchTrackerSyncResult {
        synced,
        skipped,
        errors: errors.clone(),
        synced_at: synced_at.clone(),
        note,
    })
}

pub async fn fetch_snapshots(hours: u32) -> Result<Vec<TwitchTrackerSnapshotRow>, String> {
    let since = urlencoding(
        &(chrono::Utc::now() - chrono::Duration::hours(hours as i64)).to_rfc3339(),
    );
    let query = format!(
        "/rest/v1/twitchtracker_snapshots?select=id,talent_id,login,period_days,rank,avg_viewers,max_viewers,minutes_streamed,hours_watched,followers_growth,followers_total,synced_at&organization_id=eq.{DEFAULT_ORG_ID}&synced_at=gte.{since}&order=synced_at.asc&limit=5000"
    );
    let response = supabase_request(Method::GET, &query, None, None, &[]).await?;
    let status = response.status();
    let body = response.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        tracing::warn!(%status, %body, "No se pudieron leer estadísticas externas");
        return Err("No se pudieron leer las estadísticas externas.".into());
    }
    let rows: Vec<TwitchTrackerSnapshotDbRow> =
        serde_json::from_str(&body).map_err(|e| {
            tracing::warn!(%e, "Estadísticas externas no interpretables");
            "No se pudieron interpretar las estadísticas externas.".to_string()
        })?;
    Ok(rows
        .into_iter()
        .map(|row| TwitchTrackerSnapshotRow {
            id: row.id,
            talent_id: row.talent_id,
            login: row.login,
            period_days: row.period_days,
            rank: row.rank,
            avg_viewers: row.avg_viewers,
            max_viewers: row.max_viewers,
            minutes_streamed: row.minutes_streamed,
            hours_watched: row.hours_watched,
            followers_growth: row.followers_growth,
            followers_total: row.followers_total,
            synced_at: row.synced_at,
        })
        .collect())
}

pub async fn fetch_sync_status() -> Result<TwitchTrackerSyncStatus, String> {
    let query = format!(
        "/rest/v1/twitchtracker_snapshots?select=synced_at&organization_id=eq.{DEFAULT_ORG_ID}&order=synced_at.desc&limit=1"
    );
    let response = supabase_request(Method::GET, &query, None, None, &[]).await?;
    let status = response.status();
    let body = response.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        tracing::warn!(%status, %body, "No se pudo leer estado de sincronización externa");
        return Err("No se pudo leer el estado de sincronización de estadísticas.".into());
    }

    let latest: Vec<Value> = serde_json::from_str(&body).unwrap_or_default();
    let last_sync_at = latest
        .first()
        .and_then(|row| row.get("synced_at"))
        .and_then(|value| value.as_str())
        .map(str::to_string);

    let count_query = format!(
        "/rest/v1/twitchtracker_snapshots?select=id&organization_id=eq.{DEFAULT_ORG_ID}"
    );
    let count_response = supabase_request(
        Method::GET,
        &count_query,
        None,
        None,
        &[("Prefer", "count=exact")],
    )
    .await?;
    let total_snapshots = count_response
        .headers()
        .get("content-range")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split('/').nth(1))
        .and_then(|value| value.parse::<u32>().ok())
        .unwrap_or(0);

    let last_batch_count = if let Some(ref sync_at) = last_sync_at {
        let encoded = urlencoding(sync_at);
        let batch_query = format!(
            "/rest/v1/twitchtracker_snapshots?select=id&organization_id=eq.{DEFAULT_ORG_ID}&synced_at=eq.{encoded}"
        );
        let batch_response = supabase_request(
            Method::GET,
            &batch_query,
            None,
            None,
            &[("Prefer", "count=exact")],
        )
        .await?;
        batch_response
            .headers()
            .get("content-range")
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.split('/').nth(1))
            .and_then(|value| value.parse::<u32>().ok())
            .unwrap_or(0)
    } else {
        0
    };

    Ok(TwitchTrackerSyncStatus {
        last_sync_at,
        last_synced_count: last_batch_count,
        last_error_count: 0,
        last_errors: Vec::new(),
        total_snapshots,
    })
}

pub async fn persist_sync_status_cache(
    app_dir: &std::path::Path,
    result: &TwitchTrackerSyncResult,
) {
    let payload = CachedSyncStatus {
        last_sync_at: result.synced_at.clone(),
        synced: result.synced,
        skipped: result.skipped,
        errors: result.errors.clone(),
    };
    let _ = crate::db::save_cache(
        &app_dir.join("neuragest.db"),
        "twitchtracker-sync-status",
        "twitchtracker",
        &payload,
    );
}

pub fn read_sync_status_cache(app_dir: &std::path::Path) -> Option<CachedSyncStatus> {
    crate::db::read_cache(&app_dir.join("neuragest.db"), "twitchtracker-sync-status").ok().flatten()
}

fn urlencoding(value: &str) -> String {
    url::form_urlencoded::byte_serialize(value.as_bytes()).collect()
}
