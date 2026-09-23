//! Cliente VRChat Groups (API comunitaria no oficial).
//!
//! Auth: cookie `auth` persistida (keyring) o Basic login + hooks 2FA.
//! Fuentes:
//! - GET /auth/user — https://vrchatapi.github.io/reference/get-current-user
//! - POST /auth/twofactorauth/totp/verify — https://vrchatapi.github.io/reference/verify2fa
//! - GET /groups/{groupId} — https://vrchatapi.github.io/reference/get-group
//!
//! La API no es oficial de VRChat; endpoints pueden cambiar. Errores claros al usuario.

use base64::Engine;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, COOKIE, SET_COOKIE, USER_AGENT};
use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

const API_BASE: &str = "https://api.vrchat.cloud/api/1";
const USER_AGENT_VALUE: &str = "NeuraGest/1.0 (VRChat Groups sync; +https://github.com/neuralive/neuragest)";
const DEFAULT_ORG_ID: &str = "00000000-0000-0000-0000-000000000001";
const DEFAULT_GROUP_ID: &str = "grp_627b5237-b389-41eb-9eeb-c89233c8474c";
const KEYRING_SERVICE: &str = "com.neuralive.neuragest";
const KEYRING_ACCOUNT: &str = "vrchat-auth";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredVrchatAuth {
    auth_cookie: String,
    #[serde(default)]
    two_factor_cookie: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VrchatConfigStatus {
    pub configured: bool,
    pub has_username: bool,
    pub has_password: bool,
    pub has_auth_cookie: bool,
    pub has_persisted_cookie: bool,
    pub group_id: String,
    pub group_url: String,
    pub missing_hint: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VrchatGroupSnapshotRow {
    pub id: i64,
    pub group_id: String,
    pub name: String,
    pub icon_url: Option<String>,
    pub member_count: i32,
    pub online_member_count: i32,
    pub short_code: Option<String>,
    pub discriminator: Option<String>,
    pub synced_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VrchatGroupSyncResult {
    pub ok: bool,
    pub needs_two_factor: bool,
    pub two_factor_methods: Vec<String>,
    pub snapshot: Option<VrchatGroupSnapshotRow>,
    pub group_id: String,
    pub message: String,
}

#[derive(Debug, Deserialize)]
struct GroupApiResponse {
    #[allow(dead_code)]
    id: Option<String>,
    name: Option<String>,
    #[serde(rename = "iconUrl")]
    icon_url: Option<String>,
    #[serde(rename = "memberCount")]
    member_count: Option<i32>,
    #[serde(rename = "onlineMemberCount")]
    online_member_count: Option<i32>,
    #[serde(rename = "shortCode")]
    short_code: Option<String>,
    discriminator: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TwoFactorRequired {
    #[serde(rename = "requiresTwoFactorAuth")]
    requires_two_factor_auth: Option<Vec<String>>,
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
    path_and_query: &str,
    body: Option<Value>,
    extra_headers: &[(&str, &str)],
) -> Result<reqwest::Response, String> {
    let (base, key) = supabase_config()?;
    let url = format!("{}{}", base.trim_end_matches('/'), path_and_query);
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
    request.send().await.map_err(|error| {
        tracing::warn!(%error, "Falló petición a la nube (VRChat sync)");
        "No se pudo conectar con la nube NeuraGest.".to_string()
    })
}

fn env_nonempty(key: &str) -> Option<String> {
    std::env::var(key)
        .ok()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

fn configured_group_id() -> String {
    env_nonempty("VRCHAT_GROUP_ID").unwrap_or_else(|| DEFAULT_GROUP_ID.to_string())
}

fn group_home_url(group_id: &str) -> String {
    format!("https://vrchat.com/home/group/{group_id}")
}

fn url_encode_component(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 2);
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

/// Basic auth string per VRChat docs: base64(urlencode(user):urlencode(pass))
/// Source: https://vrchatapi.github.io/reference/get-current-user
fn basic_auth_header(username: &str, password: &str) -> String {
    let raw = format!(
        "{}:{}",
        url_encode_component(username),
        url_encode_component(password)
    );
    format!(
        "Basic {}",
        base64::engine::general_purpose::STANDARD.encode(raw.as_bytes())
    )
}

fn keyring_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT).map_err(|e| e.to_string())
}

fn read_persisted_auth() -> Option<StoredVrchatAuth> {
    let entry = keyring_entry().ok()?;
    let value = entry.get_password().ok()?;
    serde_json::from_str(&value).ok()
}

fn persist_auth(auth: &StoredVrchatAuth) -> Result<(), String> {
    let entry = keyring_entry()?;
    entry
        .set_password(&serde_json::to_string(auth).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())
}

fn clear_persisted_auth() -> Result<(), String> {
    if let Ok(entry) = keyring_entry() {
        let _ = entry.delete_credential();
    }
    Ok(())
}

fn extract_cookie(headers: &HeaderMap, name: &str) -> Option<String> {
    let prefix = format!("{name}=");
    for value in headers.get_all(SET_COOKIE) {
        let Ok(raw) = value.to_str() else { continue };
        for part in raw.split(';') {
            let part = part.trim();
            if let Some(rest) = part.strip_prefix(&prefix) {
                if !rest.is_empty() {
                    return Some(rest.to_string());
                }
            }
        }
    }
    None
}

fn cookie_header(auth: &StoredVrchatAuth) -> String {
    let mut parts = vec![format!("auth={}", auth.auth_cookie)];
    if let Some(tf) = auth.two_factor_cookie.as_deref().filter(|v| !v.is_empty()) {
        parts.push(format!("twoFactorAuth={tf}"));
    }
    parts.join("; ")
}

fn build_client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent(USER_AGENT_VALUE)
        .timeout(Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
}

pub fn config_status() -> VrchatConfigStatus {
    let group_id = configured_group_id();
    let has_username = env_nonempty("VRCHAT_USERNAME").is_some();
    let has_password = env_nonempty("VRCHAT_PASSWORD").is_some();
    let has_auth_cookie = env_nonempty("VRCHAT_AUTH_COOKIE").is_some();
    let has_persisted_cookie = read_persisted_auth()
        .map(|a| !a.auth_cookie.is_empty())
        .unwrap_or(false);
    let configured = has_auth_cookie || has_persisted_cookie || (has_username && has_password);
    let missing_hint = if configured {
        None
    } else {
        Some(
            "Falta configurar el bot VRChat: añade VRCHAT_USERNAME + VRCHAT_PASSWORD \
             (o VRCHAT_AUTH_COOKIE) en `.env` y reinicia la app."
                .into(),
        )
    };
    VrchatConfigStatus {
        configured,
        has_username,
        has_password,
        has_auth_cookie,
        has_persisted_cookie,
        group_id: group_id.clone(),
        group_url: group_home_url(&group_id),
        missing_hint,
    }
}

async fn login_with_basic(
    client: &reqwest::Client,
) -> Result<(StoredVrchatAuth, Option<Vec<String>>), String> {
    let username = env_nonempty("VRCHAT_USERNAME")
        .ok_or_else(|| "Falta VRCHAT_USERNAME en `.env`.".to_string())?;
    let password = env_nonempty("VRCHAT_PASSWORD")
        .ok_or_else(|| "Falta VRCHAT_PASSWORD en `.env`.".to_string())?;

    let response = client
        .get(format!("{API_BASE}/auth/user"))
        .header(USER_AGENT, USER_AGENT_VALUE)
        .header(AUTHORIZATION, basic_auth_header(&username, &password))
        .send()
        .await
        .map_err(|e| {
            tracing::warn!(%e, "Error contactando VRChat /auth/user");
            "No se pudo conectar con la API de VRChat.".to_string()
        })?;

    let status = response.status();
    let headers = response.headers().clone();
    let body = response.text().await.map_err(|e| e.to_string())?;

    if status.as_u16() == 429 {
        return Err(
            "VRChat limitó las peticiones (429). Espera unos minutos antes de reintentar.".into(),
        );
    }
    if !status.is_success() {
        tracing::warn!(%status, %body, "VRChat rechazó login Basic");
        return Err(format!(
            "VRChat rechazó el login ({status}). Revisa usuario/contraseña o usa VRCHAT_AUTH_COOKIE."
        ));
    }

    let auth_cookie = extract_cookie(&headers, "auth").ok_or_else(|| {
        "VRChat no devolvió cookie `auth`. Prueba VRCHAT_AUTH_COOKIE manual o reintenta.".to_string()
    })?;
    let two_factor_cookie = extract_cookie(&headers, "twoFactorAuth");
    let auth = StoredVrchatAuth {
        auth_cookie,
        two_factor_cookie,
    };

    let two_factor = serde_json::from_str::<TwoFactorRequired>(&body)
        .ok()
        .and_then(|v| v.requires_two_factor_auth)
        .filter(|m| !m.is_empty());

    if two_factor.is_none() {
        persist_auth(&auth)?;
    } else {
        // Cookie temporal para completar 2FA
        persist_auth(&auth)?;
    }

    Ok((auth, two_factor))
}

async fn resolve_auth(
    client: &reqwest::Client,
) -> Result<(StoredVrchatAuth, Option<Vec<String>>), String> {
    if let Some(cookie) = env_nonempty("VRCHAT_AUTH_COOKIE") {
        let auth = StoredVrchatAuth {
            auth_cookie: cookie,
            two_factor_cookie: None,
        };
        persist_auth(&auth)?;
        return Ok((auth, None));
    }

    if let Some(persisted) = read_persisted_auth() {
        if !persisted.auth_cookie.is_empty() {
            // Validar cookie con /auth/user
            match client
                .get(format!("{API_BASE}/auth/user"))
                .header(USER_AGENT, USER_AGENT_VALUE)
                .header(COOKIE, cookie_header(&persisted))
                .send()
                .await
            {
                Ok(response) if response.status().is_success() => {
                    let headers = response.headers().clone();
                    let body = response.text().await.unwrap_or_default();
                    if let Some(methods) = serde_json::from_str::<TwoFactorRequired>(&body)
                        .ok()
                        .and_then(|v| v.requires_two_factor_auth)
                        .filter(|m| !m.is_empty())
                    {
                        return Ok((persisted, Some(methods)));
                    }
                    // Refrescar cookie si VRChat la rota
                    if let Some(new_auth) = extract_cookie(&headers, "auth") {
                        let updated = StoredVrchatAuth {
                            auth_cookie: new_auth,
                            two_factor_cookie: extract_cookie(&headers, "twoFactorAuth")
                                .or(persisted.two_factor_cookie.clone()),
                        };
                        persist_auth(&updated)?;
                        return Ok((updated, None));
                    }
                    return Ok((persisted, None));
                }
                Ok(response) => {
                    tracing::warn!(
                        status = %response.status(),
                        "Cookie VRChat inválida; intentando Basic login"
                    );
                    let _ = clear_persisted_auth();
                }
                Err(e) => {
                    tracing::warn!(%e, "No se pudo validar cookie VRChat");
                }
            }
        }
    }

    login_with_basic(client).await
}

async fn fetch_group(
    client: &reqwest::Client,
    auth: &StoredVrchatAuth,
    group_id: &str,
) -> Result<(GroupApiResponse, Value), String> {
    let url = format!("{API_BASE}/groups/{group_id}");
    let response = client
        .get(&url)
        .header(USER_AGENT, USER_AGENT_VALUE)
        .header(COOKIE, cookie_header(auth))
        .send()
        .await
        .map_err(|e| {
            tracing::warn!(%e, %group_id, "Error GET /groups");
            "No se pudo consultar el grupo en VRChat.".to_string()
        })?;

    let status = response.status();
    let body = response.text().await.map_err(|e| e.to_string())?;

    if status.as_u16() == 401 {
        let _ = clear_persisted_auth();
        return Err(
            "Sesión VRChat expirada (401). Revisa credenciales o cookie y vuelve a sincronizar."
                .into(),
        );
    }
    if status.as_u16() == 404 {
        return Err(format!(
            "Grupo no encontrado ({group_id}). Comprueba VRCHAT_GROUP_ID."
        ));
    }
    if status.as_u16() == 429 {
        return Err(
            "VRChat limitó las peticiones (429). Espera unos minutos antes de reintentar.".into(),
        );
    }
    if !status.is_success() {
        tracing::warn!(%status, %body, %group_id, "GET /groups falló");
        return Err(format!(
            "VRChat rechazó la consulta del grupo ({status}). API comunitaria — puede haber cambiado."
        ));
    }

    let raw: Value = serde_json::from_str(&body).map_err(|e| {
        tracing::warn!(%e, %body, "JSON de grupo no interpretable");
        "Respuesta de VRChat no interpretable.".to_string()
    })?;
    let group: GroupApiResponse = serde_json::from_value(raw.clone()).map_err(|e| {
        tracing::warn!(%e, "Schema de grupo inesperado");
        "Schema de grupo VRChat inesperado (API comunitaria).".to_string()
    })?;
    Ok((group, raw))
}

async fn persist_snapshot(
    group_id: &str,
    group: &GroupApiResponse,
    raw: &Value,
) -> Result<VrchatGroupSnapshotRow, String> {
    let synced_at = chrono::Utc::now().to_rfc3339();
    let name = group.name.clone().unwrap_or_default();
    let member_count = group.member_count.unwrap_or(0).max(0);
    let online_member_count = group.online_member_count.unwrap_or(0).max(0);
    let payload = json!([{
        "organization_id": DEFAULT_ORG_ID,
        "group_id": group_id,
        "name": name,
        "icon_url": group.icon_url,
        "member_count": member_count,
        "online_member_count": online_member_count,
        "short_code": group.short_code,
        "discriminator": group.discriminator,
        "raw_payload": raw,
        "synced_at": synced_at,
    }]);

    let response = supabase_request(
        Method::POST,
        "/rest/v1/vrchat_group_snapshots",
        Some(payload),
        &[("Prefer", "return=representation")],
    )
    .await?;
    let status = response.status();
    let body = response.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        tracing::warn!(%status, %body, "No se pudo guardar snapshot VRChat");
        return Err("No se pudo guardar el snapshot del grupo en la nube.".into());
    }

    #[derive(Deserialize)]
    struct Inserted {
        id: i64,
        group_id: String,
        name: String,
        icon_url: Option<String>,
        member_count: i32,
        online_member_count: i32,
        short_code: Option<String>,
        discriminator: Option<String>,
        synced_at: String,
    }
    let rows: Vec<Inserted> = serde_json::from_str(&body).map_err(|e| {
        tracing::warn!(%e, %body, "Respuesta insert VRChat no interpretable");
        "Snapshot guardado pero la respuesta no se pudo interpretar.".to_string()
    })?;
    let row = rows
        .into_iter()
        .next()
        .ok_or_else(|| "La nube no devolvió el snapshot insertado.".to_string())?;
    Ok(VrchatGroupSnapshotRow {
        id: row.id,
        group_id: row.group_id,
        name: row.name,
        icon_url: row.icon_url,
        member_count: row.member_count,
        online_member_count: row.online_member_count,
        short_code: row.short_code,
        discriminator: row.discriminator,
        synced_at: row.synced_at,
    })
}

pub async fn sync_group() -> Result<VrchatGroupSyncResult, String> {
    let status = config_status();
    if !status.configured {
        return Ok(VrchatGroupSyncResult {
            ok: false,
            needs_two_factor: false,
            two_factor_methods: vec![],
            snapshot: None,
            group_id: status.group_id.clone(),
            message: status
                .missing_hint
                .unwrap_or_else(|| "Bot VRChat no configurado.".into()),
        });
    }

    let client = build_client();
    let group_id = configured_group_id();
    let (auth, two_factor) = resolve_auth(&client).await?;

    if let Some(methods) = two_factor {
        return Ok(VrchatGroupSyncResult {
            ok: false,
            needs_two_factor: true,
            two_factor_methods: methods,
            snapshot: None,
            group_id,
            message: "Cuenta VRChat requiere 2FA. Introduce el código TOTP (o email) para completar el login.".into(),
        });
    }

    let (group, raw) = fetch_group(&client, &auth, &group_id).await?;
    let snapshot = persist_snapshot(&group_id, &group, &raw).await?;
    let members = snapshot.member_count;
    let online = snapshot.online_member_count;
    Ok(VrchatGroupSyncResult {
        ok: true,
        needs_two_factor: false,
        two_factor_methods: vec![],
        snapshot: Some(snapshot),
        group_id,
        message: format!("VRChat · {members} miembros · {online} online"),
    })
}

/// Completa 2FA tras Basic login.
/// `method`: "totp" | "email" (default totp)
/// Source: https://vrchatapi.github.io/reference/verify2fa
pub async fn verify_two_factor(code: String, method: Option<String>) -> Result<VrchatGroupSyncResult, String> {
    let code = code.trim().to_string();
    if code.is_empty() {
        return Err("Código 2FA vacío.".into());
    }
    let auth = read_persisted_auth()
        .ok_or_else(|| "No hay sesión VRChat pendiente de 2FA. Ejecuta Sync primero.".to_string())?;

    let path = match method.as_deref().unwrap_or("totp").to_ascii_lowercase().as_str() {
        "email" | "emailotp" => "/auth/twofactorauth/emailotp/verify",
        _ => "/auth/twofactorauth/totp/verify",
    };

    let client = build_client();
    let response = client
        .post(format!("{API_BASE}{path}"))
        .header(USER_AGENT, USER_AGENT_VALUE)
        .header(COOKIE, cookie_header(&auth))
        .header(
            reqwest::header::CONTENT_TYPE,
            HeaderValue::from_static("application/json"),
        )
        .json(&json!({ "code": code }))
        .send()
        .await
        .map_err(|e| {
            tracing::warn!(%e, "Error verificando 2FA VRChat");
            "No se pudo verificar el código 2FA con VRChat.".to_string()
        })?;

    let status = response.status();
    let headers = response.headers().clone();
    let body = response.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        tracing::warn!(%status, %body, "2FA VRChat rechazado");
        return Err(format!(
            "Código 2FA rechazado ({status}). Revisa el código e inténtalo de nuevo."
        ));
    }

    let new_auth = StoredVrchatAuth {
        auth_cookie: extract_cookie(&headers, "auth").unwrap_or(auth.auth_cookie),
        two_factor_cookie: extract_cookie(&headers, "twoFactorAuth").or(auth.two_factor_cookie),
    };
    persist_auth(&new_auth)?;

    // Tras 2FA, sincronizar el grupo
    sync_group().await
}

pub async fn fetch_snapshots(limit: u32) -> Result<Vec<VrchatGroupSnapshotRow>, String> {
    let group_id = configured_group_id();
    let lim = limit.clamp(1, 50);
    let path = format!(
        "/rest/v1/vrchat_group_snapshots?select=id,group_id,name,icon_url,member_count,online_member_count,short_code,discriminator,synced_at&group_id=eq.{group_id}&order=synced_at.desc&limit={lim}"
    );
    let response = supabase_request(Method::GET, &path, None, &[]).await?;
    let status = response.status();
    let body = response.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        tracing::warn!(%status, %body, "No se pudieron leer snapshots VRChat");
        return Err("No se pudieron leer los snapshots del grupo VRChat.".into());
    }

    #[derive(Deserialize)]
    struct DbRow {
        id: i64,
        group_id: String,
        name: String,
        icon_url: Option<String>,
        member_count: i32,
        online_member_count: i32,
        short_code: Option<String>,
        discriminator: Option<String>,
        synced_at: String,
    }
    let rows: Vec<DbRow> = serde_json::from_str(&body).map_err(|e| e.to_string())?;
    Ok(rows
        .into_iter()
        .map(|r| VrchatGroupSnapshotRow {
            id: r.id,
            group_id: r.group_id,
            name: r.name,
            icon_url: r.icon_url,
            member_count: r.member_count,
            online_member_count: r.online_member_count,
            short_code: r.short_code,
            discriminator: r.discriminator,
            synced_at: r.synced_at,
        })
        .collect())
}
