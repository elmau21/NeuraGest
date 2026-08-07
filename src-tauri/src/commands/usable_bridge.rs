use super::ops_bridge::{caller_app_user_id, require_manager_role};
use super::supabase_bridge::{supabase_json, supabase_request, DEFAULT_ORG_ID};
use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RateCardRecord {
    pub id: String,
    pub talent_id: String,
    pub talent_login: Option<String>,
    pub talent_display_name: Option<String>,
    pub label: String,
    pub category: String,
    pub unit_price: f64,
    pub currency: String,
    pub notes: Option<String>,
    pub is_active: bool,
    pub position: i32,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CampaignBriefRecord {
    pub id: String,
    pub deal_id: Option<String>,
    pub title: String,
    pub brand_name: Option<String>,
    pub talent_ids: Vec<String>,
    pub talent_logins: Option<Vec<String>>,
    pub objectives: Option<String>,
    pub deliverables: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub kpi_notes: Option<String>,
    pub timeline_notes: Option<String>,
    pub extra_notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgencyAssetRecord {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub storage_bucket: Option<String>,
    pub storage_path: Option<String>,
    pub file_name: Option<String>,
    pub mime_type: Option<String>,
    pub size_bytes: Option<i64>,
    pub tags: Vec<String>,
    pub external_url: Option<String>,
    pub talent_id: Option<String>,
    pub talent_login: Option<String>,
    pub deal_id: Option<String>,
    pub task_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShiftHandoffRecord {
    pub id: String,
    pub from_manager_id: String,
    pub from_manager_login: Option<String>,
    pub from_manager_display_name: Option<String>,
    pub to_manager_id: String,
    pub to_manager_login: Option<String>,
    pub to_manager_display_name: Option<String>,
    pub talent_ids: Vec<String>,
    pub talent_logins: Option<Vec<String>>,
    pub open_items_summary: Option<String>,
    pub notes: Option<String>,
    pub status: String,
    pub handoff_at: String,
    pub acknowledged_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TalentJoin {
    login: String,
    display_name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AppUserJoin {
    twitch_login: String,
    display_name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RateCardJoinRow {
    id: String,
    talent_id: String,
    label: String,
    category: String,
    unit_price: f64,
    currency: String,
    notes: Option<String>,
    is_active: bool,
    position: i32,
    talents: Option<TalentJoin>,
}

#[derive(Debug, Deserialize)]
struct BriefJoinRow {
    id: String,
    deal_id: Option<String>,
    title: String,
    brand_name: Option<String>,
    talent_ids: Option<Vec<String>>,
    objectives: Option<String>,
    deliverables: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
    kpi_notes: Option<String>,
    timeline_notes: Option<String>,
    extra_notes: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
struct AssetJoinRow {
    id: String,
    title: String,
    description: Option<String>,
    storage_bucket: Option<String>,
    storage_path: Option<String>,
    file_name: Option<String>,
    mime_type: Option<String>,
    size_bytes: Option<i64>,
    tags: Option<Vec<String>>,
    external_url: Option<String>,
    talent_id: Option<String>,
    deal_id: Option<String>,
    task_id: Option<String>,
    created_at: String,
    talents: Option<TalentJoin>,
}

#[derive(Debug, Deserialize)]
struct HandoffJoinRow {
    id: String,
    from_manager_id: String,
    to_manager_id: String,
    talent_ids: Option<Vec<String>>,
    open_items_summary: Option<String>,
    notes: Option<String>,
    status: String,
    handoff_at: String,
    acknowledged_at: Option<String>,
    from_manager: Option<AppUserJoin>,
    to_manager: Option<AppUserJoin>,
}

async fn log_activity(entity_type: &str, action: &str, metadata: Value) {
    let _ = supabase_request(
        Method::POST,
        "/rest/v1/rpc/log_activity",
        None,
        Some(json!({
            "p_entity_type": entity_type,
            "p_entity_id": Value::Null,
            "p_action": action,
            "p_metadata": metadata,
        })),
        &[("Prefer", "return=minimal")],
    )
    .await;
}

fn map_rate_card(row: RateCardJoinRow) -> RateCardRecord {
    RateCardRecord {
        id: row.id,
        talent_id: row.talent_id,
        talent_login: row.talents.as_ref().map(|t| t.login.clone()),
        talent_display_name: row.talents.as_ref().and_then(|t| t.display_name.clone()),
        label: row.label,
        category: row.category,
        unit_price: row.unit_price,
        currency: row.currency,
        notes: row.notes,
        is_active: row.is_active,
        position: row.position,
    }
}

fn map_brief(row: BriefJoinRow) -> CampaignBriefRecord {
    CampaignBriefRecord {
        id: row.id,
        deal_id: row.deal_id,
        title: row.title,
        brand_name: row.brand_name,
        talent_ids: row.talent_ids.unwrap_or_default(),
        talent_logins: None,
        objectives: row.objectives,
        deliverables: row.deliverables,
        start_date: row.start_date,
        end_date: row.end_date,
        kpi_notes: row.kpi_notes,
        timeline_notes: row.timeline_notes,
        extra_notes: row.extra_notes,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

fn map_asset(row: AssetJoinRow) -> AgencyAssetRecord {
    AgencyAssetRecord {
        id: row.id,
        title: row.title,
        description: row.description,
        storage_bucket: row.storage_bucket,
        storage_path: row.storage_path,
        file_name: row.file_name,
        mime_type: row.mime_type,
        size_bytes: row.size_bytes,
        tags: row.tags.unwrap_or_default(),
        external_url: row.external_url,
        talent_id: row.talent_id,
        talent_login: row.talents.as_ref().map(|t| t.login.clone()),
        deal_id: row.deal_id,
        task_id: row.task_id,
        created_at: row.created_at,
    }
}

fn map_handoff(row: HandoffJoinRow) -> ShiftHandoffRecord {
    ShiftHandoffRecord {
        id: row.id,
        from_manager_id: row.from_manager_id,
        from_manager_login: row.from_manager.as_ref().map(|m| m.twitch_login.clone()),
        from_manager_display_name: row.from_manager.as_ref().and_then(|m| m.display_name.clone()),
        to_manager_id: row.to_manager_id,
        to_manager_login: row.to_manager.as_ref().map(|m| m.twitch_login.clone()),
        to_manager_display_name: row.to_manager.as_ref().and_then(|m| m.display_name.clone()),
        talent_ids: row.talent_ids.unwrap_or_default(),
        talent_logins: None,
        open_items_summary: row.open_items_summary,
        notes: row.notes,
        status: row.status,
        handoff_at: row.handoff_at,
        acknowledged_at: row.acknowledged_at,
    }
}

#[tauri::command]
pub async fn list_rate_cards(talent_id: Option<String>) -> Result<Vec<RateCardRecord>, String> {
    let _ = caller_app_user_id().await?;
    let filter = talent_id
        .map(|id| format!("&talent_id=eq.{id}"))
        .unwrap_or_default();
    let query = format!(
        "/rest/v1/talent_rate_cards?select=id,talent_id,label,category,unit_price,currency,notes,is_active,position,talents(login,display_name)&deleted_at=is.null{filter}&order=position.asc,label.asc"
    );
    let response = supabase_request(Method::GET, &query, None, None, &[]).await?;
    let rows: Vec<RateCardJoinRow> = supabase_json(response, "No se pudo listar rate card").await?;
    Ok(rows.into_iter().map(map_rate_card).collect())
}

#[tauri::command]
pub async fn save_rate_card(
    id: Option<String>,
    talent_id: String,
    label: String,
    category: String,
    unit_price: f64,
    currency: Option<String>,
    notes: Option<String>,
    is_active: Option<bool>,
    position: Option<i32>,
) -> Result<RateCardRecord, String> {
    let _ = require_manager_role().await?;
    let payload = json!({
        "organization_id": DEFAULT_ORG_ID,
        "talent_id": talent_id,
        "label": label.trim(),
        "category": category,
        "unit_price": unit_price.max(0.0),
        "currency": currency.unwrap_or_else(|| "MXN".into()),
        "notes": notes,
        "is_active": is_active.unwrap_or(true),
        "position": position.unwrap_or(0),
    });
    let is_update = id.is_some();
    let existing_id = id.clone();
    let response = if let Some(card_id) = id {
        supabase_request(
            Method::PATCH,
            "/rest/v1/talent_rate_cards",
            Some(&format!("?id=eq.{card_id}")),
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
            "/rest/v1/talent_rate_cards",
            None,
            Some(payload),
            &[
                ("Prefer", "return=representation"),
                ("Accept", "application/vnd.pgrst.object+json"),
            ],
        )
        .await?
    };
    let card_id = if let Some(existing) = existing_id {
        existing
    } else {
        let created: Value = supabase_json(response, "No se pudo guardar rate card").await?;
        created
            .get("id")
            .and_then(Value::as_str)
            .ok_or_else(|| "Respuesta sin id".to_string())?
            .to_string()
    };
    log_activity(
        "rate_card",
        if is_update { "updated" } else { "created" },
        json!({ "title": label, "label": label.trim(), "talentId": talent_id }),
    )
    .await;
    let fetch = supabase_request(
        Method::GET,
        "/rest/v1/talent_rate_cards",
        Some(&format!(
            "?select=id,talent_id,label,category,unit_price,currency,notes,is_active,position,talents(login,display_name)&id=eq.{card_id}"
        )),
        None,
        &[("Accept", "application/vnd.pgrst.object+json")],
    )
    .await?;
    let row: RateCardJoinRow = supabase_json(fetch, "No se pudo leer rate card").await?;
    Ok(map_rate_card(row))
}

#[tauri::command]
pub async fn delete_rate_card(id: String) -> Result<(), String> {
    let _ = require_manager_role().await?;
    let response = supabase_request(
        Method::PATCH,
        "/rest/v1/talent_rate_cards",
        Some(&format!("?id=eq.{id}")),
        Some(json!({ "deleted_at": chrono::Utc::now().to_rfc3339() })),
        &[("Prefer", "return=minimal")],
    )
    .await?;
    if !response.status().is_success() {
        return Err(format!("No se pudo eliminar rate card ({})", response.status()));
    }
    Ok(())
}

#[tauri::command]
pub async fn list_campaign_briefs() -> Result<Vec<CampaignBriefRecord>, String> {
    let _ = caller_app_user_id().await?;
    let query = "/rest/v1/campaign_briefs?select=id,deal_id,title,brand_name,talent_ids,objectives,deliverables,start_date,end_date,kpi_notes,timeline_notes,extra_notes,created_at,updated_at&deleted_at=is.null&order=updated_at.desc";
    let response = supabase_request(Method::GET, query, None, None, &[]).await?;
    let rows: Vec<BriefJoinRow> = supabase_json(response, "No se pudo listar briefs").await?;
    Ok(rows.into_iter().map(map_brief).collect())
}

#[tauri::command]
pub async fn save_campaign_brief(
    id: Option<String>,
    deal_id: Option<String>,
    title: String,
    brand_name: Option<String>,
    talent_ids: Option<Vec<String>>,
    objectives: Option<String>,
    deliverables: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
    kpi_notes: Option<String>,
    timeline_notes: Option<String>,
    extra_notes: Option<String>,
) -> Result<CampaignBriefRecord, String> {
    let (app_user_id, _) = caller_app_user_id().await?;
    let _ = require_manager_role().await?;
    let payload = json!({
        "organization_id": DEFAULT_ORG_ID,
        "deal_id": deal_id,
        "title": title.trim(),
        "brand_name": brand_name,
        "talent_ids": talent_ids.unwrap_or_default(),
        "objectives": objectives,
        "deliverables": deliverables,
        "start_date": start_date,
        "end_date": end_date,
        "kpi_notes": kpi_notes,
        "timeline_notes": timeline_notes,
        "extra_notes": extra_notes,
        "created_by": app_user_id,
    });
    let is_update = id.is_some();
    let existing_id = id.clone();
    let response = if let Some(brief_id) = id {
        supabase_request(
            Method::PATCH,
            "/rest/v1/campaign_briefs",
            Some(&format!("?id=eq.{brief_id}")),
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
            "/rest/v1/campaign_briefs",
            None,
            Some(payload),
            &[
                ("Prefer", "return=representation"),
                ("Accept", "application/vnd.pgrst.object+json"),
            ],
        )
        .await?
    };
    let brief_id = if let Some(existing) = existing_id {
        existing
    } else {
        let created: Value = supabase_json(response, "No se pudo guardar brief").await?;
        created
            .get("id")
            .and_then(Value::as_str)
            .ok_or_else(|| "Respuesta sin id".to_string())?
            .to_string()
    };
    log_activity(
        "brief",
        if is_update { "updated" } else { "created" },
        json!({ "title": title, "brandName": brand_name }),
    )
    .await;
    let fetch = supabase_request(
        Method::GET,
        "/rest/v1/campaign_briefs",
        Some(&format!(
            "?select=id,deal_id,title,brand_name,talent_ids,objectives,deliverables,start_date,end_date,kpi_notes,timeline_notes,extra_notes,created_at,updated_at&id=eq.{brief_id}"
        )),
        None,
        &[("Accept", "application/vnd.pgrst.object+json")],
    )
    .await?;
    let row: BriefJoinRow = supabase_json(fetch, "No se pudo leer brief").await?;
    Ok(map_brief(row))
}

#[tauri::command]
pub async fn delete_campaign_brief(id: String) -> Result<(), String> {
    let _ = require_manager_role().await?;
    let response = supabase_request(
        Method::PATCH,
        "/rest/v1/campaign_briefs",
        Some(&format!("?id=eq.{id}")),
        Some(json!({ "deleted_at": chrono::Utc::now().to_rfc3339() })),
        &[("Prefer", "return=minimal")],
    )
    .await?;
    if !response.status().is_success() {
        return Err(format!("No se pudo eliminar brief ({})", response.status()));
    }
    Ok(())
}

#[tauri::command]
pub async fn list_agency_assets(tag: Option<String>) -> Result<Vec<AgencyAssetRecord>, String> {
    let _ = caller_app_user_id().await?;
    let filter = tag
        .map(|t| format!("&tags=cs.{{{}}}", t.trim()))
        .unwrap_or_default();
    let query = format!(
        "/rest/v1/agency_assets?select=id,title,description,storage_bucket,storage_path,file_name,mime_type,size_bytes,tags,external_url,talent_id,deal_id,task_id,created_at,talents(login)&deleted_at=is.null{filter}&order=created_at.desc"
    );
    let response = supabase_request(Method::GET, &query, None, None, &[]).await?;
    let rows: Vec<AssetJoinRow> = supabase_json(response, "No se pudo listar assets").await?;
    Ok(rows.into_iter().map(map_asset).collect())
}

#[tauri::command]
pub async fn save_agency_asset(
    id: Option<String>,
    title: String,
    description: Option<String>,
    storage_bucket: Option<String>,
    storage_path: Option<String>,
    file_name: Option<String>,
    mime_type: Option<String>,
    size_bytes: Option<i64>,
    tags: Option<Vec<String>>,
    external_url: Option<String>,
    talent_id: Option<String>,
    deal_id: Option<String>,
    task_id: Option<String>,
) -> Result<AgencyAssetRecord, String> {
    let (app_user_id, _) = caller_app_user_id().await?;
    let _ = require_manager_role().await?;
    let payload = json!({
        "organization_id": DEFAULT_ORG_ID,
        "title": title.trim(),
        "description": description,
        "storage_bucket": storage_bucket,
        "storage_path": storage_path,
        "file_name": file_name,
        "mime_type": mime_type,
        "size_bytes": size_bytes,
        "tags": tags.clone().unwrap_or_default(),
        "external_url": external_url,
        "talent_id": talent_id,
        "deal_id": deal_id,
        "task_id": task_id,
        "created_by": app_user_id,
    });
    let is_update = id.is_some();
    let existing_id = id.clone();
    let response = if let Some(asset_id) = id {
        supabase_request(
            Method::PATCH,
            "/rest/v1/agency_assets",
            Some(&format!("?id=eq.{asset_id}")),
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
            "/rest/v1/agency_assets",
            None,
            Some(payload),
            &[
                ("Prefer", "return=representation"),
                ("Accept", "application/vnd.pgrst.object+json"),
            ],
        )
        .await?
    };
    let asset_id = if let Some(existing) = existing_id {
        existing
    } else {
        let created: Value = supabase_json(response, "No se pudo guardar asset").await?;
        created
            .get("id")
            .and_then(Value::as_str)
            .ok_or_else(|| "Respuesta sin id".to_string())?
            .to_string()
    };
    log_activity(
        "asset",
        if is_update { "updated" } else { "created" },
        json!({ "title": title, "tags": tags }),
    )
    .await;
    let fetch = supabase_request(
        Method::GET,
        "/rest/v1/agency_assets",
        Some(&format!(
            "?select=id,title,description,storage_bucket,storage_path,file_name,mime_type,size_bytes,tags,external_url,talent_id,deal_id,task_id,created_at,talents(login)&id=eq.{asset_id}"
        )),
        None,
        &[("Accept", "application/vnd.pgrst.object+json")],
    )
    .await?;
    let row: AssetJoinRow = supabase_json(fetch, "No se pudo leer asset").await?;
    Ok(map_asset(row))
}

#[tauri::command]
pub async fn delete_agency_asset(id: String) -> Result<(), String> {
    let _ = require_manager_role().await?;
    let response = supabase_request(
        Method::PATCH,
        "/rest/v1/agency_assets",
        Some(&format!("?id=eq.{id}")),
        Some(json!({ "deleted_at": chrono::Utc::now().to_rfc3339() })),
        &[("Prefer", "return=minimal")],
    )
    .await?;
    if !response.status().is_success() {
        return Err(format!("No se pudo eliminar asset ({})", response.status()));
    }
    Ok(())
}

#[tauri::command]
pub async fn list_shift_handoffs(status: Option<String>) -> Result<Vec<ShiftHandoffRecord>, String> {
    let _ = caller_app_user_id().await?;
    let filter = status
        .map(|s| format!("&status=eq.{s}"))
        .unwrap_or_default();
    let query = format!(
        "/rest/v1/shift_handoffs?select=id,from_manager_id,to_manager_id,talent_ids,open_items_summary,notes,status,handoff_at,acknowledged_at,from_manager:app_users!shift_handoffs_from_manager_id_fkey(twitch_login,display_name),to_manager:app_users!shift_handoffs_to_manager_id_fkey(twitch_login,display_name)&organization_id=eq.{DEFAULT_ORG_ID}{filter}&order=handoff_at.desc"
    );
    let response = supabase_request(Method::GET, &query, None, None, &[]).await?;
    let rows: Vec<HandoffJoinRow> = supabase_json(response, "No se pudo listar handoffs").await?;
    Ok(rows.into_iter().map(map_handoff).collect())
}

#[tauri::command]
pub async fn create_shift_handoff(
    from_manager_id: String,
    to_manager_id: String,
    talent_ids: Vec<String>,
    open_items_summary: Option<String>,
    notes: Option<String>,
) -> Result<ShiftHandoffRecord, String> {
    let _ = require_manager_role().await?;
    let payload = json!({
        "organization_id": DEFAULT_ORG_ID,
        "from_manager_id": from_manager_id,
        "to_manager_id": to_manager_id,
        "talent_ids": talent_ids,
        "open_items_summary": open_items_summary,
        "notes": notes,
        "status": "pending",
    });
    let response = supabase_request(
        Method::POST,
        "/rest/v1/shift_handoffs",
        None,
        Some(payload),
        &[
            ("Prefer", "return=representation"),
            ("Accept", "application/vnd.pgrst.object+json"),
        ],
    )
    .await?;
    let created: Value = supabase_json(response, "No se pudo crear handoff").await?;
    let handoff_id = created
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| "Respuesta sin id".to_string())?
        .to_string();
    log_activity(
        "handoff",
        "created",
        json!({ "fromManagerId": from_manager_id, "toManagerId": to_manager_id }),
    )
    .await;
    let fetch = supabase_request(
        Method::GET,
        "/rest/v1/shift_handoffs",
        Some(&format!(
            "?select=id,from_manager_id,to_manager_id,talent_ids,open_items_summary,notes,status,handoff_at,acknowledged_at,from_manager:app_users!shift_handoffs_from_manager_id_fkey(twitch_login,display_name),to_manager:app_users!shift_handoffs_to_manager_id_fkey(twitch_login,display_name)&id=eq.{handoff_id}"
        )),
        None,
        &[("Accept", "application/vnd.pgrst.object+json")],
    )
    .await?;
    let row: HandoffJoinRow = supabase_json(fetch, "No se pudo leer handoff").await?;
    Ok(map_handoff(row))
}

#[tauri::command]
pub async fn update_handoff_status(id: String, status: String) -> Result<ShiftHandoffRecord, String> {
    let _ = require_manager_role().await?;
    let mut payload = json!({ "status": status });
    if status == "acknowledged" || status == "completed" {
        payload["acknowledged_at"] = json!(chrono::Utc::now().to_rfc3339());
    }
    let response = supabase_request(
        Method::PATCH,
        "/rest/v1/shift_handoffs",
        Some(&format!("?id=eq.{id}")),
        Some(payload),
        &[
            ("Prefer", "return=representation"),
            ("Accept", "application/vnd.pgrst.object+json"),
        ],
    )
    .await?;
    let row: HandoffJoinRow = supabase_json(response, "No se pudo actualizar handoff").await?;
    log_activity("handoff", "updated", json!({ "status": status, "id": id })).await;
    Ok(map_handoff(row))
}
