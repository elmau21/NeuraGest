use crate::commands::TalentSnapshot;
use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

const DEFAULT_ORG_ID: &str = "00000000-0000-0000-0000-000000000001";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetricSnapshotRow {
    pub id: i64,
    pub talent_id: String,
    pub login: String,
    pub viewers: i32,
    pub is_live: bool,
    pub category: Option<String>,
    pub followers: Option<i32>,
    pub captured_at: String,
}

#[derive(Debug, Deserialize)]
struct MetricSnapshotDbRow {
    id: i64,
    talent_id: String,
    login: String,
    viewers: i32,
    is_live: bool,
    category: Option<String>,
    followers: Option<i32>,
    captured_at: String,
}

#[derive(Debug, Deserialize)]
struct TalentIdRow {
    id: String,
    login: String,
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

async fn fetch_talent_ids_by_login(logins: &[String]) -> Result<std::collections::HashMap<String, String>, String> {
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
        return Err("No se pudieron leer los talentos. Intenta de nuevo.".into());
    }
    let rows: Vec<TalentIdRow> =
        serde_json::from_str(&body).map_err(|e| {
            tracing::warn!(%e, %body, "Respuesta de talentos no interpretable");
            "No se pudieron interpretar los datos de talentos.".to_string()
        })?;
    Ok(rows
        .into_iter()
        .map(|row| (row.login.to_lowercase(), row.id))
        .collect())
}

pub async fn persist_metric_snapshots(snapshots: &[TalentSnapshot]) -> Result<usize, String> {
    if snapshots.is_empty() {
        return Ok(0);
    }

    let captured_at = chrono::Utc::now().to_rfc3339();
    let logins: Vec<String> = snapshots.iter().map(|s| s.login.clone()).collect();
    let id_by_login = fetch_talent_ids_by_login(&logins).await?;

    let talent_upserts: Vec<Value> = snapshots
        .iter()
        .filter_map(|snapshot| {
            id_by_login.get(&snapshot.login.to_lowercase()).map(|_| {
                json!({
                    "organization_id": DEFAULT_ORG_ID,
                    "twitch_user_id": snapshot.id,
                    "login": snapshot.login,
                    "display_name": if snapshot.login.eq_ignore_ascii_case("nosomevt") {
                        "Nosome"
                    } else {
                        snapshot.display_name.as_str()
                    },
                    "avatar_url": snapshot.avatar,
                    "description": snapshot.description,
                    "twitch_created_at": snapshot.created_at,
                    "metadata": {
                        "is_live": snapshot.is_live,
                        "viewers": snapshot.viewers,
                        "category": snapshot.category,
                        "title": snapshot.title,
                        "last_twitch_sync_at": captured_at,
                    }
                })
            })
        })
        .collect();

    if !talent_upserts.is_empty() {
        let response = supabase_request(
            Method::POST,
            "/rest/v1/talents",
            Some("?on_conflict=organization_id,login"),
            Some(Value::Array(talent_upserts)),
            &[("Prefer", "resolution=merge-duplicates,return=minimal")],
        )
        .await?;
        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            tracing::warn!(%status, %body, "Falló upsert de talentos");
        }
    }

    let id_by_login = fetch_talent_ids_by_login(&logins).await?;
    let inserts: Vec<Value> = snapshots
        .iter()
        .filter_map(|snapshot| {
            let talent_id = id_by_login.get(&snapshot.login.to_lowercase())?;
            Some(json!({
                "organization_id": DEFAULT_ORG_ID,
                "talent_id": talent_id,
                "login": snapshot.login,
                "viewers": snapshot.viewers,
                "is_live": snapshot.is_live,
                "category": if snapshot.is_live { Some(snapshot.category.as_str()) } else { None },
                "followers": if snapshot.followers > 0 { Some(snapshot.followers as i64) } else { None::<i64> },
                "captured_at": captured_at,
            }))
        })
        .collect();

    if inserts.is_empty() {
        return Ok(0);
    }

    let count = inserts.len();
    let response = supabase_request(
        Method::POST,
        "/rest/v1/metric_snapshots",
        None,
        Some(Value::Array(inserts)),
        &[("Prefer", "return=minimal")],
    )
    .await?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        tracing::warn!(%status, %body, "No se pudo guardar historial de métricas");
        return Err("No se pudo guardar el historial de métricas.".into());
    }

    let live: Vec<&TalentSnapshot> = snapshots.iter().filter(|s| s.is_live).collect();
    if !live.is_empty() {
        persist_live_sessions(&id_by_login, &live, &captured_at).await.ok();
    }

    Ok(count)
}

async fn persist_live_sessions(
    id_by_login: &std::collections::HashMap<String, String>,
    live: &[&TalentSnapshot],
    captured_at: &str,
) -> Result<(), String> {
    let session_rows: Vec<Value> = live
        .iter()
        .filter_map(|snapshot| {
            let talent_id = id_by_login.get(&snapshot.login.to_lowercase())?;
            let stream_id = snapshot.stream_id.as_deref()?;
            let started_at = snapshot.started_at.as_deref()?;
            Some(json!({
                "organization_id": DEFAULT_ORG_ID,
                "talent_id": talent_id,
                "twitch_stream_id": stream_id,
                "title": snapshot.title,
                "category_name": snapshot.category,
                "started_at": started_at,
                "peak_viewers": snapshot.viewers,
                "ended_at": null,
            }))
        })
        .collect();

    if session_rows.is_empty() {
        return Ok(());
    }

    let response = supabase_request(
        Method::POST,
        "/rest/v1/stream_sessions",
        Some("?on_conflict=twitch_stream_id"),
        Some(Value::Array(session_rows)),
        &[("Prefer", "resolution=merge-duplicates,return=minimal")],
    )
    .await?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        tracing::warn!(%status, %body, "Falló upsert stream_sessions");
        return Ok(());
    }

    let stream_ids: Vec<String> = live
        .iter()
        .filter_map(|s| s.stream_id.clone())
        .collect();
    if stream_ids.is_empty() {
        return Ok(());
    }

    let ids = stream_ids.join(",");
    let query = format!("/rest/v1/stream_sessions?select=id,twitch_stream_id&twitch_stream_id=in.({ids})");
    let response = supabase_request(Method::GET, &query, None, None, &[]).await?;
    let sessions: Vec<Value> = {
        let status = response.status();
        let body = response.text().await.map_err(|e| e.to_string())?;
        if !status.is_success() {
            return Ok(());
        }
        serde_json::from_str(&body).unwrap_or_default()
    };

    let session_by_stream: std::collections::HashMap<String, String> = sessions
        .iter()
        .filter_map(|row| {
            Some((
                row.get("twitch_stream_id")?.as_str()?.to_string(),
                row.get("id")?.as_str()?.to_string(),
            ))
        })
        .collect();

    let metrics: Vec<Value> = live
        .iter()
        .filter_map(|snapshot| {
            let session_id = session_by_stream.get(snapshot.stream_id.as_deref()?)?;
            Some(json!({
                "organization_id": DEFAULT_ORG_ID,
                "session_id": session_id,
                "viewers": snapshot.viewers,
                "captured_at": captured_at,
            }))
        })
        .collect();

    if !metrics.is_empty() {
        let _ = supabase_request(
            Method::POST,
            "/rest/v1/stream_metrics",
            None,
            Some(Value::Array(metrics)),
            &[("Prefer", "return=minimal")],
        )
        .await;
    }

    Ok(())
}

pub async fn insert_stream_event(
    login: &str,
    event_type: &str,
    stream_id: Option<&str>,
    category: Option<&str>,
    title: Option<&str>,
) -> Result<(), String> {
    let id_by_login = fetch_talent_ids_by_login(&[login.to_string()]).await?;
    let talent_id = id_by_login.get(&login.to_lowercase());

    let body = json!({
        "organization_id": DEFAULT_ORG_ID,
        "talent_id": talent_id,
        "login": login,
        "event_type": event_type,
        "stream_id": stream_id,
        "category_name": category,
        "title": title,
        "occurred_at": chrono::Utc::now().to_rfc3339(),
    });

    let response = supabase_request(
        Method::POST,
        "/rest/v1/stream_events",
        None,
        Some(body),
        &[("Prefer", "return=minimal")],
    )
    .await?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        tracing::warn!(%status, %body, "No se pudo registrar evento de transmisión");
        return Err("No se pudo registrar el evento de transmisión.".into());
    }

    if event_type == "stream.offline" {
        if let Some(sid) = stream_id {
            let query = format!(
                "/rest/v1/stream_sessions?twitch_stream_id=eq.{sid}"
            );
            let _ = supabase_request(
                Method::PATCH,
                &query,
                None,
                Some(json!({ "ended_at": chrono::Utc::now().to_rfc3339() })),
                &[("Prefer", "return=minimal")],
            )
            .await;
        }
    }

    Ok(())
}

pub async fn fetch_metric_snapshots(
    hours: u32,
    login: Option<&str>,
) -> Result<Vec<MetricSnapshotRow>, String> {
    let since = urlencoding(&(chrono::Utc::now() - chrono::Duration::hours(hours as i64)).to_rfc3339());
    let login_filter = login
        .map(|value| format!("&login=eq.{}", urlencoding(value)))
        .unwrap_or_default();
    let query = format!(
        "/rest/v1/metric_snapshots?select=id,talent_id,login,viewers,is_live,category,followers,captured_at&organization_id=eq.{DEFAULT_ORG_ID}&captured_at=gte.{since}{login_filter}&order=captured_at.asc&limit=5000"
    );
    let response = supabase_request(Method::GET, &query, None, None, &[]).await?;
    let status = response.status();
    let body = response.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        tracing::warn!(%status, %body, "No se pudo leer historial de métricas");
        return Err("No se pudo leer el historial de métricas.".into());
    }
    let rows: Vec<MetricSnapshotDbRow> =
        serde_json::from_str(&body).map_err(|e| {
            tracing::warn!(%e, "Historial de métricas no interpretable");
            "No se pudieron interpretar los datos de métricas.".to_string()
        })?;
    Ok(rows
        .into_iter()
        .map(|row| MetricSnapshotRow {
            id: row.id,
            talent_id: row.talent_id,
            login: row.login,
            viewers: row.viewers,
            is_live: row.is_live,
            category: row.category,
            followers: row.followers,
            captured_at: row.captured_at,
        })
        .collect())
}

pub async fn fetch_stream_events(hours: u32, login: Option<&str>) -> Result<Vec<Value>, String> {
    let since = urlencoding(&(chrono::Utc::now() - chrono::Duration::hours(hours as i64)).to_rfc3339());
    let login_filter = login
        .map(|value| format!("&login=eq.{}", urlencoding(value)))
        .unwrap_or_default();
    let query = format!(
        "/rest/v1/stream_events?select=id,login,event_type,stream_id,category_name,title,occurred_at&organization_id=eq.{DEFAULT_ORG_ID}&occurred_at=gte.{since}{login_filter}&order=occurred_at.desc&limit=5000"
    );
    let response = supabase_request(Method::GET, &query, None, None, &[]).await?;
    let status = response.status();
    let body = response.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        tracing::warn!(%status, %body, "No se pudieron leer eventos de transmisión");
        return Err("No se pudieron leer los eventos de transmisión.".into());
    }
    serde_json::from_str(&body).map_err(|e| {
        tracing::warn!(%e, "Eventos de transmisión no interpretables");
        "No se pudieron interpretar los eventos de transmisión.".to_string()
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamSessionRow {
    pub id: String,
    pub talent_id: String,
    pub login: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub peak_viewers: Option<i32>,
    pub category_name: Option<String>,
    pub title: Option<String>,
}

#[derive(Debug, Deserialize)]
struct StreamSessionDbRow {
    id: String,
    talent_id: String,
    started_at: String,
    ended_at: Option<String>,
    peak_viewers: Option<i32>,
    category_name: Option<String>,
    title: Option<String>,
    talents: Option<TalentLoginJoin>,
}

#[derive(Debug, Deserialize)]
struct TalentLoginJoin {
    login: String,
}

pub async fn fetch_stream_sessions(
    hours: u32,
    login: Option<&str>,
) -> Result<Vec<StreamSessionRow>, String> {
    let since = urlencoding(&(chrono::Utc::now() - chrono::Duration::hours(hours as i64)).to_rfc3339());
    let login_filter = login
        .map(|value| format!("&talents.login=eq.{}", urlencoding(value)))
        .unwrap_or_default();
    let query = format!(
        "/rest/v1/stream_sessions?select=id,talent_id,started_at,ended_at,peak_viewers,category_name,title,talents(login)&organization_id=eq.{DEFAULT_ORG_ID}&started_at=gte.{since}{login_filter}&order=started_at.desc&limit=2000"
    );
    let response = supabase_request(Method::GET, &query, None, None, &[]).await?;
    let status = response.status();
    let body = response.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        tracing::warn!(%status, %body, "No se pudieron leer sesiones de transmisión");
        return Err("No se pudieron leer las sesiones de transmisión.".into());
    }
    let rows: Vec<StreamSessionDbRow> =
        serde_json::from_str(&body).map_err(|e| {
            tracing::warn!(%e, "Sesiones de transmisión no interpretables");
            "No se pudieron interpretar las sesiones de transmisión.".to_string()
        })?;
    Ok(rows
        .into_iter()
        .filter_map(|row| {
            let login = row.talents.map(|talent| talent.login)?;
            Some(StreamSessionRow {
                id: row.id,
                talent_id: row.talent_id,
                login,
                started_at: row.started_at,
                ended_at: row.ended_at,
                peak_viewers: row.peak_viewers,
                category_name: row.category_name,
                title: row.title,
            })
        })
        .collect())
}

#[derive(Debug, Clone)]
pub struct VodInsert {
    pub twitch_video_id: String,
    pub login: String,
    pub title: String,
    pub url: String,
    pub duration_seconds: u64,
    pub view_count: u64,
    pub published_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TalentVodRow {
    pub id: String,
    pub login: String,
    pub title: Option<String>,
    pub duration_seconds: u64,
    pub view_count: u64,
    pub published_at: String,
    pub url: Option<String>,
}

pub async fn persist_vods(vods: &[VodInsert]) -> Result<usize, String> {
    if vods.is_empty() {
        return Ok(0);
    }
    let logins: Vec<String> = vods.iter().map(|vod| vod.login.clone()).collect();
    let id_by_login = fetch_talent_ids_by_login(&logins).await?;
    let upserts: Vec<Value> = vods
        .iter()
        .filter_map(|vod| {
            let talent_id = id_by_login.get(&vod.login.to_lowercase())?;
            Some(json!({
                "organization_id": DEFAULT_ORG_ID,
                "talent_id": talent_id,
                "twitch_video_id": vod.twitch_video_id,
                "title": vod.title,
                "url": vod.url,
                "duration_seconds": vod.duration_seconds as i64,
                "view_count": vod.view_count as i64,
                "published_at": vod.published_at,
            }))
        })
        .collect();
    if upserts.is_empty() {
        return Ok(0);
    }
    let count = upserts.len();
    let response = supabase_request(
        Method::POST,
        "/rest/v1/vods",
        Some("?on_conflict=twitch_video_id"),
        Some(Value::Array(upserts)),
        &[("Prefer", "resolution=merge-duplicates,return=minimal")],
    )
    .await?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        tracing::warn!(%status, %body, "No se pudieron guardar VODs");
        return Err("No se pudieron guardar los VODs.".into());
    }
    Ok(count)
}

pub async fn fetch_vods(hours: u32, login: Option<&str>) -> Result<Vec<TalentVodRow>, String> {
    let since = urlencoding(&(chrono::Utc::now() - chrono::Duration::hours(hours as i64)).to_rfc3339());
    let login_filter = login
        .map(|value| format!("&talents.login=eq.{}", urlencoding(value)))
        .unwrap_or_default();
    let query = format!(
        "/rest/v1/vods?select=id,twitch_video_id,title,url,duration_seconds,view_count,published_at,talents(login)&organization_id=eq.{DEFAULT_ORG_ID}&published_at=gte.{since}{login_filter}&order=published_at.desc&limit=500"
    );
    let response = supabase_request(Method::GET, &query, None, None, &[]).await?;
    let status = response.status();
    let body = response.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        tracing::warn!(%status, %body, "No se pudieron leer VODs");
        return Err("No se pudieron leer los VODs.".into());
    }

    #[derive(Debug, Deserialize)]
    struct VodDbRow {
        twitch_video_id: String,
        title: Option<String>,
        url: Option<String>,
        duration_seconds: Option<i64>,
        view_count: Option<i64>,
        published_at: Option<String>,
        talents: Option<TalentLoginJoin>,
    }

    let rows: Vec<VodDbRow> =
        serde_json::from_str(&body).map_err(|e| {
            tracing::warn!(%e, "VODs no interpretables");
            "No se pudieron interpretar los VODs.".to_string()
        })?;
    Ok(rows
        .into_iter()
        .filter_map(|row| {
            let login = row.talents.map(|talent| talent.login)?;
            Some(TalentVodRow {
                id: row.twitch_video_id,
                login,
                title: row.title,
                duration_seconds: row.duration_seconds.unwrap_or(0).max(0) as u64,
                view_count: row.view_count.unwrap_or(0).max(0) as u64,
                published_at: row.published_at.unwrap_or_default(),
                url: row.url,
            })
        })
        .collect())
}

pub fn parse_vod_duration_seconds(label: &str) -> u64 {
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

fn urlencoding(value: &str) -> String {
    url::form_urlencoded::byte_serialize(value.as_bytes()).collect()
}

#[derive(Debug, Clone)]
pub struct ClipInsert {
    pub twitch_clip_id: String,
    pub login: String,
    pub title: String,
    pub url: String,
    pub thumbnail_url: String,
    pub view_count: u64,
    pub published_at: String,
}

pub async fn persist_clips(clips: &[ClipInsert]) -> Result<usize, String> {
    if clips.is_empty() {
        return Ok(0);
    }

    let logins: Vec<String> = clips.iter().map(|c| c.login.clone()).collect();
    let id_by_login = fetch_talent_ids_by_login(&logins).await?;

    let upserts: Vec<Value> = clips
        .iter()
        .filter_map(|clip| {
            let talent_id = id_by_login.get(&clip.login.to_lowercase())?;
            Some(json!({
                "organization_id": DEFAULT_ORG_ID,
                "talent_id": talent_id,
                "twitch_clip_id": clip.twitch_clip_id,
                "title": clip.title,
                "url": clip.url,
                "thumbnail_url": clip.thumbnail_url,
                "view_count": clip.view_count as i64,
                "published_at": clip.published_at,
            }))
        })
        .collect();

    if upserts.is_empty() {
        return Ok(0);
    }

    let count = upserts.len();
    let response = supabase_request(
        Method::POST,
        "/rest/v1/clips",
        Some("?on_conflict=twitch_clip_id"),
        Some(Value::Array(upserts)),
        &[("Prefer", "resolution=merge-duplicates,return=minimal")],
    )
    .await?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        tracing::warn!(%status, %body, "No se pudieron guardar clips");
        return Err("No se pudieron guardar los clips.".into());
    }
    Ok(count)
}

pub async fn sync_stream_events_from_helix(
    previous: &[crate::commands::TalentSnapshot],
    current: &[crate::commands::TalentSnapshot],
) -> Result<u32, String> {
    let prev_by_login: std::collections::HashMap<String, &crate::commands::TalentSnapshot> = previous
        .iter()
        .map(|snapshot| (snapshot.login.to_lowercase(), snapshot))
        .collect();
    let mut count = 0u32;

    for snapshot in current {
        let prev = prev_by_login.get(&snapshot.login.to_lowercase());
        let was_live = prev.map(|value| value.is_live).unwrap_or(false);

        if snapshot.is_live && !was_live {
            insert_stream_event(
                &snapshot.login,
                "stream.online",
                snapshot.stream_id.as_deref(),
                Some(snapshot.category.as_str()),
                Some(snapshot.title.as_str()),
            )
            .await?;
            count += 1;
        } else if !snapshot.is_live && was_live {
            let stream_id = prev
                .and_then(|value| value.stream_id.as_deref())
                .or(snapshot.stream_id.as_deref());
            insert_stream_event(
                &snapshot.login,
                "stream.offline",
                stream_id,
                Some(snapshot.category.as_str()),
                Some(snapshot.title.as_str()),
            )
            .await?;
            count += 1;
        }
    }

    Ok(count)
}

#[derive(Debug, Deserialize)]
struct HelixClipItem {
    id: String,
    url: String,
    title: String,
    view_count: u64,
    created_at: String,
    thumbnail_url: String,
}

#[derive(Debug, Deserialize)]
struct HelixClipResponse {
    data: Vec<HelixClipItem>,
}

#[derive(Debug, Deserialize)]
struct HelixClipUser {
    id: String,
    login: String,
}

#[derive(Debug, Deserialize)]
struct HelixClipUsersResponse {
    data: Vec<HelixClipUser>,
}

pub async fn persist_clips_from_helix(client_id: &str, access_token: &str) -> Result<u32, String> {
    let client = reqwest::Client::new();
    let mut users_url =
        url::Url::parse("https://api.twitch.tv/helix/users").map_err(|error| error.to_string())?;
    for login in crate::commands::TALENTS {
        users_url.query_pairs_mut().append_pair("login", login);
    }
    let users_response = client
        .get(users_url)
        .header("Client-Id", client_id)
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|error| {
            tracing::warn!(%error, "Error consultando perfiles Twitch para clips");
            "No se pudo consultar perfiles de Twitch para sincronizar clips.".to_string()
        })?;
    if !users_response.status().is_success() {
        tracing::warn!(status = %users_response.status(), "Perfiles Twitch rechazados al sincronizar clips");
        return Err("No se pudo obtener el perfil de Twitch para sincronizar clips.".into());
    }
    let users: HelixClipUsersResponse = users_response.json().await.map_err(|error| error.to_string())?;
    let id_by_login = fetch_talent_ids_by_login(
        &users.data.iter().map(|user| user.login.clone()).collect::<Vec<_>>(),
    )
    .await?;
    let started_at = (chrono::Utc::now() - chrono::Duration::days(7)).to_rfc3339();
    let mut upserts: Vec<Value> = Vec::new();

    for user in users.data {
        let talent_id = match id_by_login.get(&user.login.to_lowercase()) {
            Some(id) => id.clone(),
            None => continue,
        };
        let mut clips_url =
            url::Url::parse("https://api.twitch.tv/helix/clips").map_err(|error| error.to_string())?;
        clips_url
            .query_pairs_mut()
            .append_pair("broadcaster_id", &user.id)
            .append_pair("started_at", &started_at)
            .append_pair("first", "20");
        let response = client
            .get(clips_url)
            .header("Client-Id", client_id)
            .bearer_auth(access_token)
            .send()
            .await
            .map_err(|error| {
                tracing::warn!(%error, "Error obteniendo clips de Twitch");
                "No se pudieron obtener clips de Twitch.".to_string()
            })?;
        if !response.status().is_success() {
            continue;
        }
        let body: HelixClipResponse = response.json().await.map_err(|error| error.to_string())?;
        for clip in body.data {
            upserts.push(json!({
                "organization_id": DEFAULT_ORG_ID,
                "talent_id": talent_id,
                "twitch_clip_id": clip.id,
                "title": clip.title,
                "url": clip.url,
                "thumbnail_url": clip.thumbnail_url,
                "view_count": clip.view_count,
                "published_at": clip.created_at,
            }));
        }
    }

    if upserts.is_empty() {
        return Ok(0);
    }

    let count = upserts.len() as u32;
    let response = supabase_request(
        Method::POST,
        "/rest/v1/clips",
        Some("?on_conflict=twitch_clip_id"),
        Some(Value::Array(upserts)),
        &[("Prefer", "resolution=merge-duplicates,return=minimal")],
    )
    .await?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        tracing::warn!(%status, %body, "No se pudieron guardar clips en la nube");
        return Err("No se pudieron guardar los clips.".into());
    }
    Ok(count)
}
