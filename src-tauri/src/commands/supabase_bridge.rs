use super::{fetch_user_profile, valid_tokens, StoredTokens};
use reqwest::Method;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;

pub(crate) const DEFAULT_ORG_ID: &str = "00000000-0000-0000-0000-000000000001";
const PROTECTED_LOGIN: &str = "maufuwari";
const SYNTHETIC_TWITCH_EMAIL_DOMAIN: &str = "twitch.neuragest.local";
const ADMIN_ROLES: [&str; 2] = ["owner", "dev"];
const ROLE_MANAGER_ROLES: [&str; 3] = ["owner", "dev", "assistant"];
const ALL_ROLES: [&str; 11] = [
    "owner",
    "admin",
    "manager",
    "staff",
    "assistant",
    "dev",
    "designer",
    "league_manager",
    "coach",
    "analyst",
    "player",
];

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnsureAppUserResult {
    pub id: String,
    pub roles: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUserRecord {
    pub id: String,
    pub twitch_login: String,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub last_seen_at: String,
    pub roles: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct AppUserRow {
    pub(crate) id: String,
    twitch_login: String,
    display_name: Option<String>,
    avatar_url: Option<String>,
    last_seen_at: String,
    auth_user_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AuthAdminUser {
    id: String,
    email: Option<String>,
    #[serde(default)]
    user_metadata: Value,
    #[serde(default)]
    app_metadata: Value,
}

#[derive(Debug, Deserialize)]
struct RoleJoinRow {
    roles: Option<RoleNameRow>,
}

#[derive(Debug, Deserialize)]
struct RoleNameRow {
    name: String,
}

#[derive(Debug, Deserialize)]
struct AppUserRoleRow {
    app_user_id: String,
    roles: Option<RoleNameRow>,
}

pub(crate) fn supabase_config() -> Result<(String, String), String> {
    let url = std::env::var("SUPABASE_URL")
        .or_else(|_| std::env::var("VITE_SUPABASE_URL"))
        .map_err(|_| "La conexión con la nube no está configurada.".to_string())?;
    let key = std::env::var("SUPABASE_SERVICE_ROLE_KEY").map_err(|_| {
        "Falta la clave de servicio de la nube (solo en la app de escritorio).".to_string()
    })?;
    Ok((url, key))
}

pub(crate) async fn supabase_request(
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
            tracing::warn!(%error, "Error contactando nube NeuraGest");
            "No se pudo conectar con la nube NeuraGest.".to_string()
        })
}

pub(crate) async fn supabase_json<T: DeserializeOwned>(
    response: reqwest::Response,
    context: &str,
) -> Result<T, String> {
    let status = response.status();
    let url = response.url().to_string();
    let body = response
        .text()
        .await
        .map_err(|error| {
            tracing::warn!(%context, %status, %url, %error, "Error leyendo respuesta de nube");
            format!("{context}: no se pudo leer la respuesta del servidor")
        })?;
    if !status.is_success() {
        tracing::warn!(%context, %status, %url, %body, "Respuesta de nube fallida");
        return Err(format!("{context}. Intenta de nuevo más tarde."));
    }
    serde_json::from_str(&body).map_err(|error| {
        tracing::warn!(%context, %status, %url, %error, %body, "Error decodificando respuesta de nube");
        format!("{context}: la respuesta no se pudo interpretar")
    })
}

pub(crate) async fn caller_login() -> Result<(StoredTokens, String), String> {
    let tokens = valid_tokens().await?;
    let login = if let Some(login) = tokens.login.clone() {
        login
    } else {
        let (_, login, display_name, avatar_url) =
            fetch_user_profile(&tokens.client_id, &tokens.access_token).await?;
        let _ = (display_name, avatar_url);
        login
    };
    Ok((tokens, login))
}

pub(crate) async fn fetch_app_user_by_login(login: &str) -> Result<AppUserRow, String> {
    let query = format!(
        "/rest/v1/app_users?select=id,twitch_login,display_name,avatar_url,last_seen_at,auth_user_id&twitch_login=eq.{}",
        urlencoding(login)
    );
    let response = supabase_request(Method::GET, &query, None, None, &[]).await?;
    let rows: Vec<AppUserRow> =
        supabase_json(response, "No se pudo leer app_user").await?;
    rows.into_iter()
        .next()
        .ok_or_else(|| format!("Usuario no registrado: {login}"))
}

async fn fetch_app_user_by_id(user_id: &str) -> Result<AppUserRow, String> {
    let query = format!(
        "/rest/v1/app_users?select=id,twitch_login,display_name,avatar_url,last_seen_at,auth_user_id&id=eq.{}",
        user_id
    );
    let response = supabase_request(Method::GET, &query, None, None, &[]).await?;
    let rows: Vec<AppUserRow> =
        supabase_json(response, "No se pudo leer app_user").await?;
    rows.into_iter()
        .next()
        .ok_or_else(|| "Usuario objetivo inexistente.".to_string())
}

async fn fetch_roles_for_user_id(user_id: &str) -> Result<Vec<String>, String> {
    let query = format!(
        "/rest/v1/app_user_roles?select=roles(name)&app_user_id=eq.{user_id}"
    );
    let response = supabase_request(Method::GET, &query, None, None, &[]).await?;
    let rows: Vec<RoleJoinRow> =
        supabase_json(response, "No se pudieron leer roles").await?;
    Ok(rows
        .into_iter()
        .filter_map(|join| join.roles.map(|role| role.name))
        .collect())
}

async fn fetch_roles_by_user_ids(
    user_ids: &[String],
) -> Result<HashMap<String, Vec<String>>, String> {
    if user_ids.is_empty() {
        return Ok(HashMap::new());
    }
    let ids = user_ids.join(",");
    let query = format!(
        "/rest/v1/app_user_roles?select=app_user_id,roles(name)&app_user_id=in.({ids})"
    );
    let response = supabase_request(Method::GET, &query, None, None, &[]).await?;
    let rows: Vec<AppUserRoleRow> =
        supabase_json(response, "No se pudieron leer roles de usuarios").await?;
    let mut map: HashMap<String, Vec<String>> = HashMap::new();
    for row in rows {
        if let Some(role) = row.roles {
            map.entry(row.app_user_id)
                .or_default()
                .push(role.name);
        }
    }
    Ok(map)
}

fn is_synthetic_twitch_email(email: Option<&str>) -> bool {
    email
        .map(|value| value.ends_with(&format!("@{SYNTHETIC_TWITCH_EMAIL_DOMAIN}")))
        .unwrap_or(false)
}

async fn fetch_auth_user(auth_user_id: &str) -> Result<AuthAdminUser, String> {
    let path = format!("/auth/v1/admin/users/{auth_user_id}");
    let response = supabase_request(Method::GET, &path, None, None, &[]).await?;
    supabase_json(response, "No se pudo leer la cuenta de acceso").await
}

fn metadata_string(value: &Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| {
        value
            .get(key)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|item| !item.is_empty())
            .map(str::to_string)
    })
}

async fn profile_from_auth_user(auth_user_id: &str) -> Result<(String, String, String, String), String> {
    let user = fetch_auth_user(auth_user_id).await?;
    let login = metadata_string(&user.user_metadata, &[
        "preferred_username",
        "login",
        "user_name",
        "name",
        "nickname",
    ])
    .or_else(|| metadata_string(&user.app_metadata, &["provider_id"]))
    .ok_or_else(|| "La cuenta de acceso no incluye el perfil de Twitch.".to_string())?
    .replace('@', "")
    .to_lowercase();
    let twitch_id = metadata_string(&user.user_metadata, &["provider_id", "sub", "twitch_id"])
        .or_else(|| metadata_string(&user.app_metadata, &["provider_id"]))
        .unwrap_or_else(|| auth_user_id.to_string());
    let display_name = metadata_string(
        &user.user_metadata,
        &["full_name", "display_name", "name"],
    )
    .unwrap_or_else(|| login.clone());
    let avatar_url = metadata_string(
        &user.user_metadata,
        &["avatar_url", "picture", "profile_image_url"],
    )
    .unwrap_or_default();
    Ok((twitch_id, login, display_name, avatar_url))
}

async fn resolve_twitch_profile(
    auth_user_id: &str,
) -> Result<(String, String, String, String), String> {
    if let Ok((tokens, _)) = caller_login().await {
        if let Ok(profile) =
            fetch_user_profile(&tokens.client_id, &tokens.access_token).await
        {
            return Ok(profile);
        }
    }
    profile_from_auth_user(auth_user_id).await
}

async fn cleanup_synthetic_auth_user(auth_user_id: &str) -> Result<(), String> {
    let user = fetch_auth_user(auth_user_id).await?;
    if !is_synthetic_twitch_email(user.email.as_deref()) {
        return Ok(());
    }
    let path = format!("/auth/v1/admin/users/{auth_user_id}");
    let response = supabase_request(Method::DELETE, &path, None, None, &[]).await?;
    if response.status().is_success() {
        Ok(())
    } else {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        Err(format!(
            "No se pudo eliminar usuario Auth sintético ({status}): {body}"
        ))
    }
}

async fn link_auth_user_id(app_user_id: &str, auth_user_id: &str) -> Result<(), String> {
    let response = supabase_request(
        Method::PATCH,
        "/rest/v1/app_users",
        Some(&format!("?id=eq.{app_user_id}")),
        Some(json!({ "auth_user_id": auth_user_id })),
        &[("Prefer", "return=minimal")],
    )
    .await?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!(
            "No se pudo vincular auth_user_id ({status}): {body}"
        ));
    }
    Ok(())
}

async fn roles_for_login(login: &str) -> Result<Vec<String>, String> {
    let user = fetch_app_user_by_login(login).await?;
    fetch_roles_for_user_id(&user.id).await
}

fn urlencoding(value: &str) -> String {
    url::form_urlencoded::byte_serialize(value.as_bytes()).collect()
}

async fn require_role_manager(login: &str) -> Result<(), String> {
    let roles = roles_for_login(login).await?;
    if roles
        .iter()
        .any(|role| ROLE_MANAGER_ROLES.contains(&role.as_str()))
    {
        Ok(())
    } else {
        Err("No tienes permisos para administrar roles.".into())
    }
}

fn caller_is_owner_or_dev(roles: &[String]) -> bool {
    roles
        .iter()
        .any(|role| ADMIN_ROLES.contains(&role.as_str()))
}

async fn count_owners_excluding(exclude_user_id: Option<&str>) -> Result<i64, String> {
    let response = supabase_request(
        Method::GET,
        "/rest/v1/app_user_roles",
        Some("?select=app_user_id,roles!inner(name)"),
        None,
        &[],
    )
    .await?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("No se pudo contar owners ({status}): {body}"));
    }
    let rows: Vec<Value> = supabase_json(response, "No se pudo decodificar conteo de owners").await?;
    let count = rows
        .iter()
        .filter(|row| {
            row.pointer("/roles/name")
                .and_then(Value::as_str)
                .is_some_and(|name| name == "owner")
                && exclude_user_id
                    .and_then(|exclude_id| row.get("app_user_id").and_then(Value::as_str).map(|user_id| (exclude_id, user_id)))
                    .is_none_or(|(exclude_id, user_id)| user_id != exclude_id)
        })
        .count() as i64;
    Ok(count)
}

#[tauri::command]
pub async fn ensure_app_user(auth_user_id: String) -> Result<EnsureAppUserResult, String> {
    if auth_user_id.trim().is_empty() {
        return Err("El identificador de sesión es obligatorio.".into());
    }

    let (twitch_id, login, display_name, avatar_url) = resolve_twitch_profile(&auth_user_id).await?;
    let now = chrono::Utc::now().to_rfc3339();

    let body = json!({
        "organization_id": DEFAULT_ORG_ID,
        "twitch_login": login.to_lowercase(),
        "twitch_user_id": twitch_id,
        "display_name": display_name,
        "avatar_url": avatar_url,
        "last_seen_at": now,
    });

    let response = supabase_request(
        Method::POST,
        "/rest/v1/app_users",
        Some("?on_conflict=twitch_login"),
        Some(body),
        &[
            ("Prefer", "resolution=merge-duplicates,return=representation"),
            ("Accept", "application/vnd.pgrst.object+json"),
        ],
    )
    .await?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!(
            "No se pudo registrar app_user ({status}): {body}"
        ));
    }

    let user: AppUserRow =
        supabase_json(response, "No se pudo decodificar app_user creado").await?;

    if let Some(previous_auth_user_id) = user.auth_user_id.as_deref() {
        if previous_auth_user_id != auth_user_id {
            let _ = cleanup_synthetic_auth_user(previous_auth_user_id).await;
        }
    }

    if user.auth_user_id.as_deref() != Some(auth_user_id.as_str()) {
        link_auth_user_id(&user.id, &auth_user_id).await.map_err(|error| {
            format!(
                "Sesión iniciada, pero no se pudo vincular tu perfil: {error}"
            )
        })?;
    }

    let roles = roles_for_login(&user.twitch_login).await.unwrap_or_default();

    Ok(EnsureAppUserResult {
        id: user.id,
        roles,
    })
}

#[tauri::command]
pub async fn fetch_my_roles() -> Result<Vec<String>, String> {
    let (_, login) = caller_login().await?;
    roles_for_login(&login.to_lowercase()).await
}

#[tauri::command]
pub async fn list_app_users() -> Result<Vec<AppUserRecord>, String> {
    let (_, login) = caller_login().await?;
    require_role_manager(&login.to_lowercase()).await?;

    let response = supabase_request(
        Method::GET,
        "/rest/v1/app_users",
        Some("?select=id,twitch_login,display_name,avatar_url,last_seen_at,auth_user_id&order=last_seen_at.desc"),
        None,
        &[],
    )
    .await?;

    let rows: Vec<AppUserRow> =
        supabase_json(response, "No se pudo listar usuarios").await?;
    let user_ids: Vec<String> = rows.iter().map(|row| row.id.clone()).collect();
    let roles_by_user = fetch_roles_by_user_ids(&user_ids).await?;

    Ok(rows
        .into_iter()
        .map(|row| AppUserRecord {
            roles: roles_by_user.get(&row.id).cloned().unwrap_or_default(),
            id: row.id,
            twitch_login: row.twitch_login,
            display_name: row.display_name,
            avatar_url: row.avatar_url,
            last_seen_at: row.last_seen_at,
        })
        .collect())
}

#[tauri::command]
pub async fn set_app_user_roles(
    target_user_id: String,
    roles: Vec<String>,
    confirm_protected: bool,
) -> Result<Vec<String>, String> {
    let (_, caller) = caller_login().await?;
    require_role_manager(&caller.to_lowercase()).await?;

    for role in &roles {
        if !ALL_ROLES.contains(&role.as_str()) {
            return Err(format!("Rol inválido: {role}"));
        }
    }

    let target = fetch_app_user_by_id(&target_user_id).await?;
    let current_roles = fetch_roles_for_user_id(&target_user_id).await?;
    let next_has_owner = roles.iter().any(|role| role == "owner");
    let current_has_owner = current_roles.iter().any(|role| role == "owner");

    if current_has_owner && !next_has_owner {
        let remaining = count_owners_excluding(Some(&target_user_id)).await?;
        if remaining == 0 {
            return Err("No puedes quitar el último owner de la organización.".into());
        }
    }

    let caller_roles = roles_for_login(&caller.to_lowercase()).await?;
    let caller_is_owner = caller_roles.iter().any(|role| role == "owner");
    let caller_elevated = caller_is_owner_or_dev(&caller_roles);

    if next_has_owner && !caller_is_owner {
        return Err("Solo un owner puede asignar el rol owner.".into());
    }
    if current_has_owner && !next_has_owner && !caller_is_owner {
        return Err("Solo un owner puede quitar el rol owner.".into());
    }

    let is_protected = target.twitch_login.eq_ignore_ascii_case(PROTECTED_LOGIN);
    if is_protected {
        let losing_admin = ADMIN_ROLES.iter().any(|role| current_roles.iter().any(|r| r == role))
            && !ADMIN_ROLES.iter().any(|role| roles.iter().any(|r| r == role));
        if losing_admin {
            if !caller_elevated {
                return Err(
                    "No puedes degradar roles owner/dev de MauFuwari.".into(),
                );
            }
            if !confirm_protected {
                return Err(
                    "MauFuwari requiere confirmación explícita para degradar roles owner/dev.".into(),
                );
            }
        }
    }

    supabase_request(
        Method::DELETE,
        "/rest/v1/app_user_roles",
        Some(&format!("?app_user_id=eq.{target_user_id}")),
        None,
        &[],
    )
    .await?;

    if roles.is_empty() {
        return Ok(vec![]);
    }

    let roles_response = supabase_request(
        Method::GET,
        "/rest/v1/roles",
        Some(&format!(
            "?select=id,name&name=in.({})",
            roles.join(",")
        )),
        None,
        &[],
    )
    .await?;
    if !roles_response.status().is_success() {
        let status = roles_response.status();
        let body = roles_response.text().await.unwrap_or_default();
        return Err(format!("No se pudieron resolver los IDs de roles ({status}): {body}"));
    }
    let role_rows: Vec<Value> =
        supabase_json(roles_response, "No se pudieron decodificar roles").await?;
    let inserts: Vec<Value> = role_rows
        .into_iter()
        .filter_map(|row| {
            let role_id = row.get("id")?.as_str()?;
            Some(json!({ "app_user_id": target_user_id, "role_id": role_id }))
        })
        .collect();

    if inserts.is_empty() {
        return Ok(vec![]);
    }

    let insert_response = supabase_request(
        Method::POST,
        "/rest/v1/app_user_roles",
        None,
        Some(Value::Array(inserts)),
        &[("Prefer", "return=minimal")],
    )
    .await?;
    if !insert_response.status().is_success() {
        let status = insert_response.status();
        let body = insert_response.text().await.unwrap_or_default();
        return Err(format!(
            "No se pudieron asignar roles ({status}): {body}"
        ));
    }

    Ok(roles)
}
