use super::supabase_bridge::{
    caller_login, fetch_app_user_by_login, supabase_json, supabase_request, DEFAULT_ORG_ID,
};
use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TalentManagerRecord {
    pub id: String,
    pub talent_id: String,
    pub talent_login: String,
    pub talent_display_name: String,
    pub manager_app_user_id: String,
    pub manager_login: String,
    pub manager_display_name: Option<String>,
    pub assigned_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PipelineItemRecord {
    pub id: String,
    pub talent_id: Option<String>,
    pub talent_login: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub content_type: String,
    pub url: Option<String>,
    pub position: f64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SponsorshipDealRecord {
    pub id: String,
    pub brand_name: String,
    pub talent_id: Option<String>,
    pub talent_login: Option<String>,
    pub deal_value: Option<f64>,
    pub currency: String,
    pub deliverables: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub progress_percent: i32,
    pub status: String,
    pub task_id: Option<String>,
    pub calendar_event_id: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OnboardingItemRecord {
    pub id: String,
    pub talent_id: String,
    pub talent_login: String,
    pub title: String,
    pub description: Option<String>,
    pub position: i32,
    pub completed: bool,
    pub completed_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TalentManagerJoinRow {
    id: String,
    talent_id: String,
    manager_app_user_id: String,
    assigned_at: String,
    talents: Option<TalentJoin>,
    manager: Option<AppUserJoin>,
}

#[derive(Debug, Deserialize)]
struct TalentJoin {
    login: String,
    display_name: String,
}

#[derive(Debug, Deserialize)]
struct AppUserJoin {
    twitch_login: String,
    display_name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PipelineJoinRow {
    id: String,
    talent_id: Option<String>,
    title: String,
    description: Option<String>,
    status: String,
    content_type: String,
    url: Option<String>,
    position: f64,
    created_at: String,
    updated_at: String,
    talents: Option<TalentJoin>,
}

#[derive(Debug, Deserialize)]
struct SponsorshipJoinRow {
    id: String,
    brand_name: String,
    talent_id: Option<String>,
    deal_value: Option<f64>,
    currency: String,
    deliverables: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
    progress_percent: i32,
    status: String,
    task_id: Option<String>,
    calendar_event_id: Option<String>,
    notes: Option<String>,
    created_at: String,
    updated_at: String,
    talents: Option<TalentJoin>,
}

#[derive(Debug, Deserialize)]
struct OnboardingJoinRow {
    id: String,
    talent_id: String,
    title: String,
    description: Option<String>,
    position: i32,
    completed: bool,
    completed_at: Option<String>,
    talents: Option<TalentJoin>,
}

async fn caller_app_user_id() -> Result<(String, String), String> {
    let (_, login) = caller_login().await?;
    let user = fetch_app_user_by_login(&login.to_lowercase()).await?;
    Ok((user.id, login.to_lowercase()))
}

async fn require_manager_role() -> Result<String, String> {
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

fn map_talent_manager(row: TalentManagerJoinRow) -> TalentManagerRecord {
    TalentManagerRecord {
        id: row.id,
        talent_id: row.talent_id,
        manager_app_user_id: row.manager_app_user_id,
        assigned_at: row.assigned_at,
        talent_login: row
            .talents
            .as_ref()
            .map(|t| t.login.clone())
            .unwrap_or_default(),
        talent_display_name: row
            .talents
            .as_ref()
            .map(|t| t.display_name.clone())
            .unwrap_or_default(),
        manager_login: row
            .manager
            .as_ref()
            .map(|m| m.twitch_login.clone())
            .unwrap_or_default(),
        manager_display_name: row.manager.and_then(|m| m.display_name),
    }
}

fn map_pipeline(row: PipelineJoinRow) -> PipelineItemRecord {
    PipelineItemRecord {
        id: row.id,
        talent_id: row.talent_id,
        talent_login: row.talents.map(|t| t.login),
        title: row.title,
        description: row.description,
        status: row.status,
        content_type: row.content_type,
        url: row.url,
        position: row.position,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

fn map_sponsorship(row: SponsorshipJoinRow) -> SponsorshipDealRecord {
    SponsorshipDealRecord {
        id: row.id,
        brand_name: row.brand_name,
        talent_id: row.talent_id,
        talent_login: row.talents.map(|t| t.login),
        deal_value: row.deal_value,
        currency: row.currency,
        deliverables: row.deliverables,
        start_date: row.start_date,
        end_date: row.end_date,
        progress_percent: row.progress_percent,
        status: row.status,
        task_id: row.task_id,
        calendar_event_id: row.calendar_event_id,
        notes: row.notes,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

fn map_onboarding(row: OnboardingJoinRow) -> OnboardingItemRecord {
    OnboardingItemRecord {
        id: row.id,
        talent_id: row.talent_id,
        talent_login: row
            .talents
            .as_ref()
            .map(|t| t.login.clone())
            .unwrap_or_default(),
        title: row.title,
        description: row.description,
        position: row.position,
        completed: row.completed,
        completed_at: row.completed_at,
    }
}

#[tauri::command]
pub async fn list_talent_managers() -> Result<Vec<TalentManagerRecord>, String> {
    let _ = caller_app_user_id().await?;
    let query = "/rest/v1/talent_managers?select=id,talent_id,manager_app_user_id,assigned_at,talents(login,display_name),manager:app_users!talent_managers_manager_app_user_id_fkey(twitch_login,display_name)&order=assigned_at.desc";
    let response = supabase_request(Method::GET, query, None, None, &[]).await?;
    let rows: Vec<TalentManagerJoinRow> =
        supabase_json(response, "No se pudieron listar responsables").await?;
    Ok(rows.into_iter().map(map_talent_manager).collect())
}

#[tauri::command]
pub async fn assign_talent_manager(
    talent_id: String,
    manager_app_user_id: String,
) -> Result<TalentManagerRecord, String> {
    let app_user_id = require_manager_role().await?;
    let body = json!({
        "organization_id": DEFAULT_ORG_ID,
        "talent_id": talent_id,
        "manager_app_user_id": manager_app_user_id,
        "assigned_by": app_user_id,
    });
    let response = supabase_request(
        Method::POST,
        "/rest/v1/talent_managers",
        None,
        Some(body),
        &[
            ("Prefer", "return=representation"),
            ("Accept", "application/vnd.pgrst.object+json"),
        ],
    )
    .await?;
    let created: Value = supabase_json(response, "No se pudo asignar responsable").await?;
    let new_id = created
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| "Respuesta sin id".to_string())?;
    let fetch = supabase_request(
        Method::GET,
        "/rest/v1/talent_managers",
        Some(&format!(
            "?select=id,talent_id,manager_app_user_id,assigned_at,talents(login,display_name),manager:app_users!talent_managers_manager_app_user_id_fkey(twitch_login,display_name)&id=eq.{new_id}"
        )),
        None,
        &[
            ("Accept", "application/vnd.pgrst.object+json"),
        ],
    )
    .await?;
    let row: TalentManagerJoinRow = supabase_json(fetch, "No se pudo leer asignación").await?;
    Ok(map_talent_manager(row))
}

#[tauri::command]
pub async fn remove_talent_manager(id: String) -> Result<(), String> {
    let _ = require_manager_role().await?;
    let response = supabase_request(
        Method::DELETE,
        "/rest/v1/talent_managers",
        Some(&format!("?id=eq.{id}")),
        None,
        &[],
    )
    .await?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("No se pudo quitar asignación ({status}): {body}"));
    }
    Ok(())
}

#[tauri::command]
pub async fn list_pipeline_items() -> Result<Vec<PipelineItemRecord>, String> {
    let _ = caller_app_user_id().await?;
    let query = "/rest/v1/content_pipeline_items?select=id,talent_id,title,description,status,content_type,url,position,created_at,updated_at,talents(login,display_name)&deleted_at=is.null&order=position.asc,created_at.desc";
    let response = supabase_request(Method::GET, query, None, None, &[]).await?;
    let rows: Vec<PipelineJoinRow> =
        supabase_json(response, "No se pudo listar pipeline").await?;
    Ok(rows.into_iter().map(map_pipeline).collect())
}

#[tauri::command]
pub async fn save_pipeline_item(
    id: Option<String>,
    talent_id: Option<String>,
    title: String,
    description: Option<String>,
    status: String,
    content_type: String,
    url: Option<String>,
    position: Option<f64>,
) -> Result<PipelineItemRecord, String> {
    let (app_user_id, _) = caller_app_user_id().await?;
    let _ = require_manager_role().await?;
    let payload = json!({
        "organization_id": DEFAULT_ORG_ID,
        "talent_id": talent_id,
        "title": title,
        "description": description,
        "status": status,
        "content_type": content_type,
        "url": url,
        "position": position.unwrap_or(0.0),
        "created_by": app_user_id,
    });
    let existing_id = id.clone();
    let response = if let Some(item_id) = id {
        supabase_request(
            Method::PATCH,
            "/rest/v1/content_pipeline_items",
            Some(&format!("?id=eq.{item_id}")),
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
            "/rest/v1/content_pipeline_items",
            None,
            Some(payload),
            &[
                ("Prefer", "return=representation"),
                ("Accept", "application/vnd.pgrst.object+json"),
            ],
        )
        .await?
    };
    let created: Value = supabase_json(response, "No se pudo guardar ítem de pipeline").await?;
    let item_id = if let Some(existing) = existing_id {
        existing
    } else {
        created
            .get("id")
            .and_then(Value::as_str)
            .ok_or_else(|| "Respuesta sin id".to_string())?
            .to_string()
    };
    let fetch = supabase_request(
        Method::GET,
        "/rest/v1/content_pipeline_items",
        Some(&format!(
            "?select=id,talent_id,title,description,status,content_type,url,position,created_at,updated_at,talents(login,display_name)&id=eq.{item_id}"
        )),
        None,
        &[("Accept", "application/vnd.pgrst.object+json")],
    )
    .await?;
    let row: PipelineJoinRow = supabase_json(fetch, "No se pudo leer ítem").await?;
    Ok(map_pipeline(row))
}

#[tauri::command]
pub async fn update_pipeline_status(id: String, status: String) -> Result<PipelineItemRecord, String> {
    let _ = require_manager_role().await?;
    let response = supabase_request(
        Method::PATCH,
        "/rest/v1/content_pipeline_items",
        Some(&format!("?id=eq.{id}")),
        Some(json!({ "status": status })),
        &[
            ("Prefer", "return=representation"),
            ("Accept", "application/vnd.pgrst.object+json"),
        ],
    )
    .await?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("No se pudo actualizar estado ({status}): {body}"));
    }
    let fetch = supabase_request(
        Method::GET,
        "/rest/v1/content_pipeline_items",
        Some(&format!(
            "?select=id,talent_id,title,description,status,content_type,url,position,created_at,updated_at,talents(login,display_name)&id=eq.{id}"
        )),
        None,
        &[("Accept", "application/vnd.pgrst.object+json")],
    )
    .await?;
    let row: PipelineJoinRow = supabase_json(fetch, "No se pudo leer ítem").await?;
    Ok(map_pipeline(row))
}

#[tauri::command]
pub async fn delete_pipeline_item(id: String) -> Result<(), String> {
    let _ = require_manager_role().await?;
    let response = supabase_request(
        Method::PATCH,
        "/rest/v1/content_pipeline_items",
        Some(&format!("?id=eq.{id}")),
        Some(json!({ "deleted_at": chrono::Utc::now().to_rfc3339() })),
        &[("Prefer", "return=minimal")],
    )
    .await?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("No se pudo eliminar ítem ({status}): {body}"));
    }
    Ok(())
}

#[tauri::command]
pub async fn list_sponsorship_deals() -> Result<Vec<SponsorshipDealRecord>, String> {
    let _ = caller_app_user_id().await?;
    let query = "/rest/v1/sponsorship_deals?select=id,brand_name,talent_id,deal_value,currency,deliverables,start_date,end_date,progress_percent,status,task_id,calendar_event_id,notes,created_at,updated_at,talents(login,display_name)&deleted_at=is.null&order=updated_at.desc";
    let response = supabase_request(Method::GET, query, None, None, &[]).await?;
    let rows: Vec<SponsorshipJoinRow> =
        supabase_json(response, "No se pudo listar CRM").await?;
    Ok(rows.into_iter().map(map_sponsorship).collect())
}

#[tauri::command]
pub async fn save_sponsorship_deal(
    id: Option<String>,
    brand_name: String,
    talent_id: Option<String>,
    deal_value: Option<f64>,
    currency: Option<String>,
    deliverables: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
    progress_percent: i32,
    status: String,
    task_id: Option<String>,
    calendar_event_id: Option<String>,
    notes: Option<String>,
) -> Result<SponsorshipDealRecord, String> {
    let _ = require_manager_role().await?;
    let payload = json!({
        "organization_id": DEFAULT_ORG_ID,
        "brand_name": brand_name,
        "talent_id": talent_id,
        "deal_value": deal_value,
        "currency": currency.unwrap_or_else(|| "MXN".into()),
        "deliverables": deliverables,
        "start_date": start_date,
        "end_date": end_date,
        "progress_percent": progress_percent.clamp(0, 100),
        "status": status,
        "task_id": task_id,
        "calendar_event_id": calendar_event_id,
        "notes": notes,
    });
    let existing_id = id.clone();
    let response = if let Some(deal_id) = id {
        supabase_request(
            Method::PATCH,
            "/rest/v1/sponsorship_deals",
            Some(&format!("?id=eq.{deal_id}")),
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
            "/rest/v1/sponsorship_deals",
            None,
            Some(payload),
            &[
                ("Prefer", "return=representation"),
                ("Accept", "application/vnd.pgrst.object+json"),
            ],
        )
        .await?
    };
    let deal_id = if let Some(existing) = existing_id {
        existing
    } else {
        let created: Value = supabase_json(response, "No se pudo guardar patrocinio").await?;
        created
            .get("id")
            .and_then(Value::as_str)
            .ok_or_else(|| "Respuesta sin id".to_string())?
            .to_string()
    };
    let fetch = supabase_request(
        Method::GET,
        "/rest/v1/sponsorship_deals",
        Some(&format!(
            "?select=id,brand_name,talent_id,deal_value,currency,deliverables,start_date,end_date,progress_percent,status,task_id,calendar_event_id,notes,created_at,updated_at,talents(login,display_name)&id=eq.{deal_id}"
        )),
        None,
        &[("Accept", "application/vnd.pgrst.object+json")],
    )
    .await?;
    let row: SponsorshipJoinRow = supabase_json(fetch, "No se pudo leer patrocinio").await?;
    Ok(map_sponsorship(row))
}

#[tauri::command]
pub async fn delete_sponsorship_deal(id: String) -> Result<(), String> {
    let _ = require_manager_role().await?;
    let response = supabase_request(
        Method::PATCH,
        "/rest/v1/sponsorship_deals",
        Some(&format!("?id=eq.{id}")),
        Some(json!({ "deleted_at": chrono::Utc::now().to_rfc3339() })),
        &[("Prefer", "return=minimal")],
    )
    .await?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("No se pudo eliminar patrocinio ({status}): {body}"));
    }
    Ok(())
}

#[tauri::command]
pub async fn list_onboarding_items(talent_id: Option<String>) -> Result<Vec<OnboardingItemRecord>, String> {
    let _ = caller_app_user_id().await?;
    let query = if let Some(tid) = talent_id {
        format!(
            "/rest/v1/talent_onboarding_items?select=id,talent_id,title,description,position,completed,completed_at,talents(login,display_name)&talent_id=eq.{tid}&order=position.asc"
        )
    } else {
        "/rest/v1/talent_onboarding_items?select=id,talent_id,title,description,position,completed,completed_at,talents(login,display_name)&order=position.asc".to_string()
    };
    let response = supabase_request(Method::GET, &query, None, None, &[]).await?;
    let rows: Vec<OnboardingJoinRow> =
        supabase_json(response, "No se pudo listar onboarding").await?;
    Ok(rows.into_iter().map(map_onboarding).collect())
}

#[tauri::command]
pub async fn seed_talent_onboarding(talent_id: String) -> Result<Vec<OnboardingItemRecord>, String> {
    let _ = require_manager_role().await?;
    let response = supabase_request(
        Method::POST,
        "/rest/v1/rpc/seed_talent_onboarding",
        None,
        Some(json!({ "p_talent_id": talent_id, "p_org_id": DEFAULT_ORG_ID })),
        &[("Prefer", "return=minimal")],
    )
    .await?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("No se pudo inicializar onboarding ({status}): {body}"));
    }
    list_onboarding_items(Some(talent_id)).await
}

#[tauri::command]
pub async fn toggle_onboarding_item(id: String, completed: bool) -> Result<OnboardingItemRecord, String> {
    let _ = require_manager_role().await?;
    let payload = if completed {
        json!({ "completed": true, "completed_at": chrono::Utc::now().to_rfc3339() })
    } else {
        json!({ "completed": false, "completed_at": Value::Null })
    };
    let response = supabase_request(
        Method::PATCH,
        "/rest/v1/talent_onboarding_items",
        Some(&format!("?id=eq.{id}")),
        Some(payload),
        &[
            ("Prefer", "return=representation"),
            ("Accept", "application/vnd.pgrst.object+json"),
        ],
    )
    .await?;
    let row: OnboardingJoinRow = supabase_json(response, "No se pudo actualizar ítem").await?;
    Ok(map_onboarding(row))
}

#[tauri::command]
pub async fn list_db_talents() -> Result<Vec<Value>, String> {
    let _ = caller_app_user_id().await?;
    let query = "/rest/v1/talents?select=id,login,display_name,avatar_url&deleted_at=is.null&order=display_name.asc";
    let response = supabase_request(Method::GET, query, None, None, &[]).await?;
    supabase_json(response, "No se pudieron listar talentos").await
}
