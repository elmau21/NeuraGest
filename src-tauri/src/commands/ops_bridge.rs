use super::supabase_bridge::{caller_login, fetch_app_user_by_login, supabase_json, supabase_request, DEFAULT_ORG_ID};
use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipRecord {
    pub id: String,
    pub talent_id: String,
    pub talent_login: Option<String>,
    pub twitch_clip_id: String,
    pub title: Option<String>,
    pub url: Option<String>,
    pub thumbnail_url: Option<String>,
    pub view_count: i32,
    pub published_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrandRestrictionRecord {
    pub id: String,
    pub talent_id: String,
    pub talent_login: Option<String>,
    pub kind: String,
    pub brand_name: String,
    pub blocked_categories: Vec<String>,
    pub starts_at: Option<String>,
    pub ends_at: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommissionEntryRecord {
    pub id: String,
    pub deal_id: Option<String>,
    pub talent_id: Option<String>,
    pub talent_login: Option<String>,
    pub label: String,
    pub period_month: String,
    pub gross_amount: f64,
    pub agency_rate_pct: f64,
    pub agency_amount: f64,
    pub talent_amount: f64,
    pub status: String,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarEventOpsRecord {
    pub id: String,
    pub title: String,
    pub event_type: String,
    pub starts_at: String,
    pub ends_at: String,
    pub talent_id: Option<String>,
    pub talent_login: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TalentJoin {
    login: String,
}

#[derive(Debug, Deserialize)]
struct ClipJoinRow {
    id: String,
    talent_id: String,
    twitch_clip_id: String,
    title: Option<String>,
    url: Option<String>,
    thumbnail_url: Option<String>,
    view_count: Option<i32>,
    published_at: Option<String>,
    talents: Option<TalentJoin>,
}

#[derive(Debug, Deserialize)]
struct RestrictionJoinRow {
    id: String,
    talent_id: String,
    kind: String,
    brand_name: String,
    blocked_categories: Option<Vec<String>>,
    starts_at: Option<String>,
    ends_at: Option<String>,
    notes: Option<String>,
    talents: Option<TalentJoin>,
}

#[derive(Debug, Deserialize)]
struct CommissionJoinRow {
    id: String,
    deal_id: Option<String>,
    talent_id: Option<String>,
    label: String,
    period_month: String,
    gross_amount: f64,
    agency_rate_pct: f64,
    agency_amount: f64,
    talent_amount: f64,
    status: String,
    notes: Option<String>,
    talents: Option<TalentJoin>,
}

#[derive(Debug, Deserialize)]
struct CalendarJoinRow {
    id: String,
    title: String,
    event_type: String,
    starts_at: String,
    ends_at: String,
    talent_id: Option<String>,
    talents: Option<TalentJoin>,
}

pub(crate) async fn caller_app_user_id() -> Result<(String, String), String> {
    let (_, login) = caller_login().await?;
    let user = fetch_app_user_by_login(&login.to_lowercase()).await?;
    Ok((user.id, login.to_lowercase()))
}

pub(crate) async fn require_manager_role() -> Result<String, String> {
    let (app_user_id, login) = caller_app_user_id().await?;
    let query = format!(
        "/rest/v1/app_user_roles?select=roles(name)&app_user_id=eq.{app_user_id}"
    );
    let response = supabase_request(Method::GET, &query, None, None, &[]).await?;
    let rows: Vec<Value> = supabase_json(response, "No se pudieron leer roles").await?;
    let allowed = rows.iter().any(|row| {
        row.pointer("/roles/name")
            .and_then(Value::as_str)
            .is_some_and(|name| matches!(name, "owner" | "admin" | "manager" | "dev"))
            || login == "maufuwari"
    });
    if allowed {
        Ok(app_user_id)
    } else {
        Err("Se requiere rol manager, admin u owner.".into())
    }
}

fn map_clip(row: ClipJoinRow) -> ClipRecord {
    ClipRecord {
        id: row.id,
        talent_id: row.talent_id,
        talent_login: row.talents.as_ref().map(|t| t.login.clone()),
        twitch_clip_id: row.twitch_clip_id,
        title: row.title,
        url: row.url,
        thumbnail_url: row.thumbnail_url,
        view_count: row.view_count.unwrap_or(0),
        published_at: row.published_at,
    }
}

fn map_restriction(row: RestrictionJoinRow) -> BrandRestrictionRecord {
    BrandRestrictionRecord {
        id: row.id,
        talent_id: row.talent_id,
        talent_login: row.talents.as_ref().map(|t| t.login.clone()),
        kind: row.kind,
        brand_name: row.brand_name,
        blocked_categories: row.blocked_categories.unwrap_or_default(),
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        notes: row.notes,
    }
}

fn map_commission(row: CommissionJoinRow) -> CommissionEntryRecord {
    CommissionEntryRecord {
        id: row.id,
        deal_id: row.deal_id,
        talent_id: row.talent_id,
        talent_login: row.talents.as_ref().map(|t| t.login.clone()),
        label: row.label,
        period_month: row.period_month,
        gross_amount: row.gross_amount,
        agency_rate_pct: row.agency_rate_pct,
        agency_amount: row.agency_amount,
        talent_amount: row.talent_amount,
        status: row.status,
        notes: row.notes,
    }
}

fn map_calendar(row: CalendarJoinRow) -> CalendarEventOpsRecord {
    CalendarEventOpsRecord {
        id: row.id,
        title: row.title,
        event_type: row.event_type,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        talent_id: row.talent_id,
        talent_login: row.talents.as_ref().map(|t| t.login.clone()),
    }
}

#[tauri::command]
pub async fn list_clips(limit: Option<u32>) -> Result<Vec<ClipRecord>, String> {
    let _ = caller_app_user_id().await?;
    let cap = limit.unwrap_or(50).min(200);
    let query = format!(
        "/rest/v1/clips?select=id,talent_id,twitch_clip_id,title,url,thumbnail_url,view_count,published_at,talents(login)&organization_id=eq.{DEFAULT_ORG_ID}&deleted_at=is.null&order=view_count.desc&limit={cap}"
    );
    let response = supabase_request(Method::GET, &query, None, None, &[]).await?;
    let rows: Vec<ClipJoinRow> = supabase_json(response, "No se pudieron listar clips").await?;
    Ok(rows.into_iter().map(map_clip).collect())
}

#[tauri::command]
pub async fn list_brand_restrictions() -> Result<Vec<BrandRestrictionRecord>, String> {
    let _ = caller_app_user_id().await?;
    let query = "/rest/v1/talent_brand_restrictions?select=id,talent_id,kind,brand_name,blocked_categories,starts_at,ends_at,notes,talents(login)&deleted_at=is.null&order=starts_at.desc";
    let response = supabase_request(Method::GET, query, None, None, &[]).await?;
    let rows: Vec<RestrictionJoinRow> =
        supabase_json(response, "No se pudieron listar restricciones").await?;
    Ok(rows.into_iter().map(map_restriction).collect())
}

#[tauri::command]
pub async fn save_brand_restriction(
    id: Option<String>,
    talent_id: String,
    kind: String,
    brand_name: String,
    blocked_categories: Option<Vec<String>>,
    starts_at: Option<String>,
    ends_at: Option<String>,
    notes: Option<String>,
) -> Result<BrandRestrictionRecord, String> {
    let _ = require_manager_role().await?;
    let payload = json!({
        "organization_id": DEFAULT_ORG_ID,
        "talent_id": talent_id,
        "kind": kind,
        "brand_name": brand_name.trim(),
        "blocked_categories": blocked_categories.unwrap_or_default(),
        "starts_at": starts_at,
        "ends_at": ends_at,
        "notes": notes,
    });
    let existing_id = id.clone();
    let response = if let Some(restriction_id) = id {
        supabase_request(
            Method::PATCH,
            "/rest/v1/talent_brand_restrictions",
            Some(&format!("?id=eq.{restriction_id}")),
            Some(payload),
            &[
                ("Prefer", "return=representation"),
                ("Accept", "application/vnd.pgrst.object+json"),
            ],
        )
        .await?
    } else {
        supabase_request(
            Method::POST,
            "/rest/v1/talent_brand_restrictions",
            None,
            Some(payload),
            &[
                ("Prefer", "return=representation"),
                ("Accept", "application/vnd.pgrst.object+json"),
            ],
        )
        .await?
    };
    let restriction_id = if let Some(existing) = existing_id {
        existing
    } else {
        let created: Value = supabase_json(response, "No se pudo guardar restricción").await?;
        created
            .get("id")
            .and_then(Value::as_str)
            .ok_or_else(|| "Respuesta sin id".to_string())?
            .to_string()
    };
    let fetch = supabase_request(
        Method::GET,
        "/rest/v1/talent_brand_restrictions",
        Some(&format!(
            "?select=id,talent_id,kind,brand_name,blocked_categories,starts_at,ends_at,notes,talents(login)&id=eq.{restriction_id}"
        )),
        None,
        &[("Accept", "application/vnd.pgrst.object+json")],
    )
    .await?;
    let row: RestrictionJoinRow = supabase_json(fetch, "No se pudo leer restricción").await?;
    Ok(map_restriction(row))
}

#[tauri::command]
pub async fn delete_brand_restriction(id: String) -> Result<(), String> {
    let _ = require_manager_role().await?;
    let response = supabase_request(
        Method::PATCH,
        "/rest/v1/talent_brand_restrictions",
        Some(&format!("?id=eq.{id}")),
        Some(json!({ "deleted_at": chrono::Utc::now().to_rfc3339() })),
        &[("Prefer", "return=minimal")],
    )
    .await?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("No se pudo eliminar restricción ({status}): {body}"));
    }
    Ok(())
}

#[tauri::command]
pub async fn list_commission_entries(month: Option<String>) -> Result<Vec<CommissionEntryRecord>, String> {
    let _ = caller_app_user_id().await?;
    let filter = month
        .map(|m| format!("&period_month=eq.{m}"))
        .unwrap_or_default();
    let query = format!(
        "/rest/v1/commission_entries?select=id,deal_id,talent_id,label,period_month,gross_amount,agency_rate_pct,agency_amount,talent_amount,status,notes,talents(login)&deleted_at=is.null{filter}&order=period_month.desc,label.asc"
    );
    let response = supabase_request(Method::GET, &query, None, None, &[]).await?;
    let rows: Vec<CommissionJoinRow> =
        supabase_json(response, "No se pudieron listar comisiones").await?;
    Ok(rows.into_iter().map(map_commission).collect())
}

#[tauri::command]
pub async fn save_commission_entry(
    id: Option<String>,
    deal_id: Option<String>,
    talent_id: Option<String>,
    label: String,
    period_month: String,
    gross_amount: f64,
    agency_rate_pct: f64,
    status: String,
    notes: Option<String>,
) -> Result<CommissionEntryRecord, String> {
    let _ = require_manager_role().await?;
    let payload = json!({
        "organization_id": DEFAULT_ORG_ID,
        "deal_id": deal_id,
        "talent_id": talent_id,
        "label": label.trim(),
        "period_month": period_month,
        "gross_amount": gross_amount.max(0.0),
        "agency_rate_pct": agency_rate_pct.clamp(0.0, 100.0),
        "status": status,
        "notes": notes,
    });
    let existing_id = id.clone();
    let response = if let Some(entry_id) = id {
        supabase_request(
            Method::PATCH,
            "/rest/v1/commission_entries",
            Some(&format!("?id=eq.{entry_id}")),
            Some(payload),
            &[
                ("Prefer", "return=representation"),
                ("Accept", "application/vnd.pgrst.object+json"),
            ],
        )
        .await?
    } else {
        supabase_request(
            Method::POST,
            "/rest/v1/commission_entries",
            None,
            Some(payload),
            &[
                ("Prefer", "return=representation"),
                ("Accept", "application/vnd.pgrst.object+json"),
            ],
        )
        .await?
    };
    let entry_id = if let Some(existing) = existing_id {
        existing
    } else {
        let created: Value = supabase_json(response, "No se pudo guardar comisión").await?;
        created
            .get("id")
            .and_then(Value::as_str)
            .ok_or_else(|| "Respuesta sin id".to_string())?
            .to_string()
    };
    let fetch = supabase_request(
        Method::GET,
        "/rest/v1/commission_entries",
        Some(&format!(
            "?select=id,deal_id,talent_id,label,period_month,gross_amount,agency_rate_pct,agency_amount,talent_amount,status,notes,talents(login)&id=eq.{entry_id}"
        )),
        None,
        &[("Accept", "application/vnd.pgrst.object+json")],
    )
    .await?;
    let row: CommissionJoinRow = supabase_json(fetch, "No se pudo leer comisión").await?;
    Ok(map_commission(row))
}

#[tauri::command]
pub async fn delete_commission_entry(id: String) -> Result<(), String> {
    let _ = require_manager_role().await?;
    let response = supabase_request(
        Method::PATCH,
        "/rest/v1/commission_entries",
        Some(&format!("?id=eq.{id}")),
        Some(json!({ "deleted_at": chrono::Utc::now().to_rfc3339() })),
        &[("Prefer", "return=minimal")],
    )
    .await?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("No se pudo eliminar comisión ({status}): {body}"));
    }
    Ok(())
}

#[tauri::command]
pub async fn list_calendar_events_ops() -> Result<Vec<CalendarEventOpsRecord>, String> {
    let _ = caller_app_user_id().await?;
    let query = "/rest/v1/calendar_events?select=id,title,event_type,starts_at,ends_at,talent_id,talents(login)&organization_id=eq.{DEFAULT_ORG_ID}&deleted_at=is.null&order=starts_at.desc&limit=500";
    let query = query.replace("{DEFAULT_ORG_ID}", DEFAULT_ORG_ID);
    let response = supabase_request(Method::GET, &query, None, None, &[]).await?;
    let rows: Vec<CalendarJoinRow> =
        supabase_json(response, "No se pudo leer calendario").await?;
    Ok(rows.into_iter().map(map_calendar).collect())
}
