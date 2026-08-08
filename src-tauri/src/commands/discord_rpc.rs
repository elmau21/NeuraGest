//! Discord Rich Presence (IPC local). Independiente de webhooks.
//! Si Discord no está abierto, falla en silencio (solo log).

use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

const DEFAULT_DETAILS: &str = "Operaciones Twitch · NeuraLive";
const DEFAULT_STATE: &str = "En NeuraGest";
/// Application ID de la app Discord NeuraGest (agencia). Público por diseño (RPC).
const AGENCY_DEFAULT_APPLICATION_ID: &str = "1535443541634064424";
/// Claves de Art Asset en Discord Developer Portal → Rich Presence → Art Assets.
const LARGE_IMAGE_KEY: &str = "neuragest";
const LARGE_IMAGE_TEXT: &str = "NeuraLive";
const SMALL_IMAGE_KEY: &str = "neuragest_icon";
const DEFAULT_SMALL_TEXT: &str = "En vivo en NeuraGest";
const MAX_BUTTONS: usize = 2;

struct PresenceSession {
    client: DiscordIpcClient,
    application_id: String,
    started_at_ms: i64,
}

static SESSION: Mutex<Option<PresenceSession>> = Mutex::new(None);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscordRpcStatus {
    pub connected: bool,
    pub enabled: bool,
    pub application_id: Option<String>,
    pub message: String,
}

fn default_use_large_image() -> bool {
    true
}

fn default_use_small_image() -> bool {
    true
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscordRpcPresencePayload {
    pub enabled: bool,
    /// Application ID (Client ID) de Discord Developer Portal. Vacío = usar env.
    #[serde(default)]
    pub application_id: Option<String>,
    #[serde(default)]
    pub details: Option<String>,
    #[serde(default)]
    pub state: Option<String>,
    /// Si true, adjunta large_image `neuragest` (requiere Art Asset en el portal).
    #[serde(default = "default_use_large_image")]
    pub use_large_image: bool,
    /// Badge circular `neuragest_icon` (solo tiene sentido con large_image).
    #[serde(default = "default_use_small_image")]
    pub use_small_image: bool,
    /// Hover del small_image (español).
    #[serde(default)]
    pub small_text: Option<String>,
    /// Botones opcionales (máx. 2). Solo se usan URLs http(s) reales.
    #[serde(default)]
    pub buttons: Option<Vec<DiscordRpcButton>>,
    /// Cierra IPC, clear_activity y reconecta antes de set (útil tras subir Art Assets).
    #[serde(default)]
    pub force_refresh: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscordRpcButton {
    pub label: String,
    pub url: String,
}

#[derive(Debug, Clone)]
struct PresenceButton {
    label: String,
    url: String,
}

/// Unix ms — el crate `discord-rich-presence` documenta timestamps en milisegundos.
fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn embedded_application_id() -> Option<String> {
    std::env::var("DISCORD_APPLICATION_ID")
        .ok()
        .filter(|v| !v.trim().is_empty())
        .or_else(|| {
            std::env::var("DISCORD_CLIENT_ID")
                .ok()
                .filter(|v| !v.trim().is_empty())
        })
        .or_else(|| Some(AGENCY_DEFAULT_APPLICATION_ID.to_string()))
}

fn resolve_application_id(override_id: Option<&str>) -> Option<String> {
    override_id
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(|v| v.to_string())
        .or_else(embedded_application_id)
}

fn normalize_line(value: Option<&str>, fallback: &str) -> String {
    value
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .unwrap_or(fallback)
        .chars()
        .take(128)
        .collect()
}

fn is_http_url(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    (lower.starts_with("https://") || lower.starts_with("http://")) && value.len() <= 512
}

fn env_url(keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Ok(value) = std::env::var(key) {
            let trimmed = value.trim();
            if is_http_url(trimmed) {
                return Some(trimmed.to_string());
            }
        }
    }
    None
}

fn resolve_buttons(payload_buttons: Option<&[DiscordRpcButton]>) -> Vec<PresenceButton> {
    let mut out: Vec<PresenceButton> = Vec::new();

    if let Some(list) = payload_buttons {
        for btn in list {
            let label = btn.label.trim().chars().take(32).collect::<String>();
            let url = btn.url.trim();
            if label.is_empty() || !is_http_url(url) {
                continue;
            }
            out.push(PresenceButton {
                label,
                url: url.to_string(),
            });
            if out.len() >= MAX_BUTTONS {
                return out;
            }
        }
    }

    if out.is_empty() {
        if let Some(url) = env_url(&["NEURALIVE_URL", "VITE_NEURALIVE_URL"]) {
            out.push(PresenceButton {
                label: "NeuraLive".to_string(),
                url,
            });
        }
        if out.len() < MAX_BUTTONS {
            if let Some(url) = env_url(&[
                "DISCORD_INVITE_URL",
                "NEURAGEST_DISCORD_INVITE",
                "VITE_DISCORD_INVITE_URL",
            ]) {
                out.push(PresenceButton {
                    label: "Discord".to_string(),
                    url,
                });
            }
        }
    }

    out.truncate(MAX_BUTTONS);
    out
}

fn status(connected: bool, enabled: bool, application_id: Option<String>, message: impl Into<String>) -> DiscordRpcStatus {
    DiscordRpcStatus {
        connected,
        enabled,
        application_id,
        message: message.into(),
    }
}

fn disconnect_locked(guard: &mut Option<PresenceSession>) {
    if let Some(mut session) = guard.take() {
        if let Err(error) = session.client.clear_activity() {
            tracing::debug!(%error, "No se pudo limpiar Discord Rich Presence al desconectar");
        }
        if let Err(error) = session.client.close() {
            tracing::debug!(%error, "No se pudo cerrar IPC Discord Rich Presence");
        }
    }
}

/// Cierra la sesión IPC (salida de la app). Errores solo a log.
pub fn shutdown() {
    let Ok(mut guard) = SESSION.lock() else {
        return;
    };
    disconnect_locked(&mut guard);
}

fn ensure_connected<'a>(
    guard: &'a mut Option<PresenceSession>,
    application_id: &str,
    force_refresh: bool,
) -> Result<&'a mut PresenceSession, String> {
    let needs_reconnect = force_refresh
        || match guard.as_ref() {
            Some(session) => session.application_id != application_id,
            None => true,
        };
    if needs_reconnect {
        disconnect_locked(guard);
        let mut client = DiscordIpcClient::new(application_id);
        client.connect().map_err(|error| {
            tracing::info!(%error, "Discord no disponible para Rich Presence (¿está abierto?)");
            "Discord no está disponible. Ábrelo e inténtalo de nuevo.".to_string()
        })?;
        *guard = Some(PresenceSession {
            client,
            application_id: application_id.to_string(),
            started_at_ms: now_ms(),
        });
        tracing::info!(%application_id, force_refresh, "Discord Rich Presence conectado");
    }
    Ok(guard.as_mut().expect("sesión RPC recién creada"))
}

#[derive(Clone, Copy)]
struct AssetMode {
    large: bool,
    small: bool,
}

fn build_activity<'a>(
    details: &'a str,
    state: &'a str,
    started_at_ms: i64,
    assets_mode: AssetMode,
    small_text: &'a str,
    buttons: &'a [PresenceButton],
) -> activity::Activity<'a> {
    let timestamps = activity::Timestamps::new().start(started_at_ms);
    let mut base = activity::Activity::new()
        .details(details)
        .state(state)
        .timestamps(timestamps);

    if assets_mode.large {
        let mut assets = activity::Assets::new()
            .large_image(LARGE_IMAGE_KEY)
            .large_text(LARGE_IMAGE_TEXT);
        if assets_mode.small {
            assets = assets
                .small_image(SMALL_IMAGE_KEY)
                .small_text(small_text);
        }
        base = base.assets(assets);
    }

    if !buttons.is_empty() {
        let rpc_buttons: Vec<_> = buttons
            .iter()
            .map(|b| activity::Button::new(b.label.as_str(), b.url.as_str()))
            .collect();
        base = base.buttons(rpc_buttons);
    }

    base
}

fn apply_activity(
    session: &mut PresenceSession,
    details: &str,
    state: &str,
    use_large_image: bool,
    use_small_image: bool,
    small_text: &str,
    buttons: &[PresenceButton],
) -> Result<(), String> {
    let started = session.started_at_ms;
    // Clear previo: Discord a veces cachea activity sin asset y deja el «?» tras subir el PNG.
    if let Err(error) = session.client.clear_activity() {
        tracing::debug!(%error, "clear_activity previo a set (ignorado)");
    }

    let want_small = use_large_image && use_small_image;
    let attempts = [
        AssetMode {
            large: use_large_image,
            small: want_small,
        },
        AssetMode {
            large: use_large_image,
            small: false,
        },
        AssetMode {
            large: false,
            small: false,
        },
    ];

    let mut last_error: Option<String> = None;
    for mode in attempts {
        if !use_large_image && mode.large {
            continue;
        }
        if mode.small && !want_small {
            continue;
        }
        // Evitar reintentos idénticos (p. ej. large=false dos veces).
        match session
            .client
            .set_activity(build_activity(details, state, started, mode, small_text, buttons))
        {
            Ok(()) => {
                if mode.large {
                    tracing::info!(
                        large_image = LARGE_IMAGE_KEY,
                        small_image = if mode.small { SMALL_IMAGE_KEY } else { "" },
                        buttons = buttons.len(),
                        "Rich Presence enviado (si ves «?», reinicia Discord: cache 5–15 min)"
                    );
                }
                return Ok(());
            }
            Err(error) => {
                tracing::info!(
                    %error,
                    large = mode.large,
                    small = mode.small,
                    "Rich Presence set_activity falló; probando degradación de assets"
                );
                last_error = Some(error.to_string());
            }
        }
        // Último recurso: sin botones (Discord a veces rechaza combos raros).
        if !buttons.is_empty() && !mode.large {
            if let Err(error) = session.client.set_activity(build_activity(
                details,
                state,
                started,
                AssetMode {
                    large: false,
                    small: false,
                },
                small_text,
                &[],
            )) {
                last_error = Some(error.to_string());
            } else {
                return Ok(());
            }
        }
    }

    let error = last_error.unwrap_or_else(|| "set_activity falló".to_string());
    tracing::warn!(%error, "Falló set_activity Discord Rich Presence");
    let _ = session.client.close();
    Err(error)
}

#[tauri::command]
pub fn discord_rpc_default_application_id() -> Option<String> {
    embedded_application_id()
}

#[tauri::command]
pub fn discord_rpc_status() -> DiscordRpcStatus {
    let connected = SESSION
        .lock()
        .ok()
        .map(|g| g.is_some())
        .unwrap_or(false);
    let application_id = embedded_application_id();
    if connected {
        status(true, true, application_id, "Estado en Discord activo")
    } else {
        status(
            false,
            false,
            application_id,
            "Estado en Discord inactivo",
        )
    }
}

#[tauri::command]
pub fn discord_rpc_set_presence(payload: DiscordRpcPresencePayload) -> DiscordRpcStatus {
    if !payload.enabled {
        shutdown();
        return status(
            false,
            false,
            resolve_application_id(payload.application_id.as_deref()),
            "Estado en Discord desactivado",
        );
    }

    let Some(application_id) = resolve_application_id(payload.application_id.as_deref()) else {
        return status(
            false,
            true,
            None,
            "No hay Application ID de Discord. Revisa DISCORD_APPLICATION_ID o Personalizar ID en Ajustes.",
        );
    };

    let details = normalize_line(payload.details.as_deref(), DEFAULT_DETAILS);
    let state = normalize_line(payload.state.as_deref(), DEFAULT_STATE);
    let small_text = normalize_line(payload.small_text.as_deref(), DEFAULT_SMALL_TEXT);
    let buttons = resolve_buttons(payload.buttons.as_deref());

    let Ok(mut guard) = SESSION.lock() else {
        return status(false, true, Some(application_id), "No se pudo actualizar el estado en Discord");
    };

    tracing::info!(
        %application_id,
        details = %details,
        state = %state,
        use_large_image = payload.use_large_image,
        use_small_image = payload.use_small_image,
        large_image = LARGE_IMAGE_KEY,
        small_image = SMALL_IMAGE_KEY,
        buttons = buttons.len(),
        force_refresh = payload.force_refresh,
        "Aplicando Discord Rich Presence"
    );

    match ensure_connected(&mut guard, &application_id, payload.force_refresh) {
        Ok(session) => {
            match apply_activity(
                session,
                &details,
                &state,
                payload.use_large_image,
                payload.use_small_image,
                &small_text,
                &buttons,
            ) {
                Ok(()) => {
                    tracing::info!(%application_id, "Discord Rich Presence activo");
                    status(
                        true,
                        true,
                        Some(application_id),
                        "Estado en Discord actualizado",
                    )
                }
                Err(_) => {
                    disconnect_locked(&mut guard);
                    // Intento único de reconexión
                    match ensure_connected(&mut guard, &application_id, true) {
                        Ok(session) => match apply_activity(
                            session,
                            &details,
                            &state,
                            payload.use_large_image,
                            payload.use_small_image,
                            &small_text,
                            &buttons,
                        ) {
                            Ok(()) => {
                                tracing::info!(%application_id, "Discord Rich Presence activo tras reconectar");
                                status(
                                    true,
                                    true,
                                    Some(application_id),
                                    "Estado en Discord actualizado",
                                )
                            }
                            Err(_) => status(
                                false,
                                true,
                                Some(application_id),
                                "No se pudo actualizar el estado (Discord cerrado o no responde)",
                            ),
                        },
                        Err(message) => status(false, true, Some(application_id), message),
                    }
                }
            }
        }
        Err(message) => status(false, true, Some(application_id), message),
    }
}

#[tauri::command]
pub fn discord_rpc_clear() -> DiscordRpcStatus {
    shutdown();
    status(false, false, embedded_application_id(), "Estado en Discord limpiado")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_line_uses_fallback_and_trims() {
        assert_eq!(normalize_line(None, "X"), "X");
        assert_eq!(normalize_line(Some("  hola  "), "X"), "hola");
        assert_eq!(normalize_line(Some(""), "X"), "X");
    }

    #[test]
    fn resolve_prefers_override() {
        assert_eq!(
            resolve_application_id(Some(" 123456 ")).as_deref(),
            Some("123456")
        );
    }

    #[test]
    fn resolve_without_override_always_has_id() {
        // Env o constante de agencia — nunca None para usuarios normales.
        assert!(resolve_application_id(None).is_some());
        assert_eq!(
            resolve_application_id(None).as_deref(),
            embedded_application_id().as_deref()
        );
    }

    #[test]
    fn default_assets_are_on() {
        assert!(default_use_large_image());
        assert!(default_use_small_image());
        assert_eq!(LARGE_IMAGE_KEY, "neuragest");
        assert_eq!(SMALL_IMAGE_KEY, "neuragest_icon");
        assert_eq!(LARGE_IMAGE_TEXT, "NeuraLive");
    }

    #[test]
    fn is_http_url_rejects_junk() {
        assert!(is_http_url("https://neuralive.example"));
        assert!(!is_http_url("ftp://x"));
        assert!(!is_http_url("not-a-url"));
        assert!(!is_http_url(""));
    }

    #[test]
    fn resolve_buttons_ignores_invalid_payload() {
        let buttons = resolve_buttons(Some(&[DiscordRpcButton {
            label: "X".into(),
            url: "notaurl".into(),
        }]));
        // Puede incluir env si existe; al menos no incluye la inválida.
        assert!(buttons.iter().all(|b| is_http_url(&b.url)));
    }
}
