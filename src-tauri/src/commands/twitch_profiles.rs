use serde::{Deserialize, Serialize};
use std::{collections::HashMap, path::PathBuf, sync::OnceLock};
use tokio::sync::RwLock;

const SERVICE: &str = "com.neuralive.neuragest";
const PROFILES_FILE: &str = "twitch-helix-profiles.json";
const DEFAULT_PROFILE_ID: &str = "env-default";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HelixProfile {
    pub id: String,
    pub name: String,
    pub client_id: String,
    #[serde(default)]
    pub has_secret: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct ProfileStore {
    active_id: Option<String>,
    profiles: Vec<HelixProfile>,
}

static PROFILE_CACHE: OnceLock<RwLock<ProfileStore>> = OnceLock::new();

fn cache() -> &'static RwLock<ProfileStore> {
    PROFILE_CACHE.get_or_init(|| RwLock::new(ProfileStore::default()))
}

fn profiles_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    use tauri::Manager;
    Ok(app.path().app_data_dir().map_err(|e| e.to_string())?.join(PROFILES_FILE))
}

fn secret_account(profile_id: &str) -> String {
    format!("twitch-helix-secret-{profile_id}")
}

async fn load_store(app: &tauri::AppHandle) -> Result<ProfileStore, String> {
    let path = profiles_path(app)?;
    if !path.is_file() {
        return Ok(ProfileStore::default());
    }
    let raw = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| {
            tracing::warn!(%e, "Error leyendo perfiles Twitch");
            "No se pudieron leer los perfiles de Twitch.".to_string()
        })?;
    serde_json::from_str(&raw).map_err(|e| {
        tracing::warn!(%e, "Perfiles Twitch no interpretables");
        "No se pudieron interpretar los perfiles de Twitch.".to_string()
    })
}

async fn save_store(app: &tauri::AppHandle, store: &ProfileStore) -> Result<(), String> {
    let path = profiles_path(app)?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| e.to_string())?;
    }
    let raw = serde_json::to_string_pretty(store).map_err(|e| e.to_string())?;
    tokio::fs::write(&path, raw)
        .await
        .map_err(|e| {
            tracing::warn!(%e, "Error guardando perfiles Twitch");
            "No se pudieron guardar los perfiles de Twitch.".to_string()
        })
}

fn env_default_profile() -> Option<HelixProfile> {
    let client_id = std::env::var("TWITCH_CLIENT_ID").ok()?;
    Some(HelixProfile {
        id: DEFAULT_PROFILE_ID.into(),
        name: "Entorno (.env)".into(),
        client_id,
        has_secret: std::env::var("TWITCH_CLIENT_SECRET").is_ok(),
    })
}

pub async fn resolve_helix_credentials(app: &tauri::AppHandle) -> Result<(String, String), String> {
    let store = {
        let cached = cache().read().await;
        if !cached.profiles.is_empty() {
            (*cached).clone()
        } else {
            drop(cached);
            load_store(app).await?
        }
    };

    let active_id = store
        .active_id
        .as_deref()
        .or_else(|| store.profiles.first().map(|p| p.id.as_str()));

    if let Some(id) = active_id {
        if id == DEFAULT_PROFILE_ID {
            return Ok((
                std::env::var("TWITCH_CLIENT_ID")
                    .map_err(|_| super::TWITCH_CONFIG_MISSING.to_string())?,
                std::env::var("TWITCH_CLIENT_SECRET")
                    .map_err(|_| super::TWITCH_CONFIG_MISSING.to_string())?,
            ));
        }
        if let Some(profile) = store.profiles.iter().find(|p| p.id == id) {
            let secret = keyring::Entry::new(SERVICE, &secret_account(id))
                .map_err(|e| e.to_string())?
                .get_password()
                .map_err(|_| format!("No se encontró la clave secreta del perfil «{}»", profile.name))?;
            return Ok((profile.client_id.clone(), secret));
        }
    }

    Ok((
        std::env::var("TWITCH_CLIENT_ID")
            .map_err(|_| super::TWITCH_CONFIG_MISSING.to_string())?,
        std::env::var("TWITCH_CLIENT_SECRET")
            .map_err(|_| super::TWITCH_CONFIG_MISSING.to_string())?,
    ))
}

pub(crate) async fn configured_client_id_for(app: &tauri::AppHandle) -> Result<String, String> {
    resolve_helix_credentials(app).await.map(|(id, _)| id)
}

pub(crate) async fn configured_client_secret_for(app: &tauri::AppHandle) -> Result<String, String> {
    resolve_helix_credentials(app).await.map(|(_, secret)| secret)
}

#[tauri::command]
pub async fn list_helix_profiles(app: tauri::AppHandle) -> Result<Vec<HelixProfile>, String> {
    let mut store = load_store(&app).await?;
    if store.profiles.is_empty() {
        if let Some(default) = env_default_profile() {
            store.profiles.push(default);
            store.active_id = Some(DEFAULT_PROFILE_ID.into());
        }
    }
    *cache().write().await = store.clone();
    Ok(store.profiles)
}

#[tauri::command]
pub async fn get_active_helix_profile(app: tauri::AppHandle) -> Result<Option<HelixProfile>, String> {
    let profiles = list_helix_profiles(app.clone()).await?;
    let store = {
        let cached = cache().read().await;
        (*cached).clone()
    };
    let active_id = store
        .active_id
        .or_else(|| profiles.first().map(|p| p.id.clone()));
    Ok(active_id.and_then(|id| profiles.into_iter().find(|p| p.id == id)))
}

#[tauri::command]
pub async fn save_helix_profile(
    app: tauri::AppHandle,
    id: Option<String>,
    name: String,
    client_id: String,
    client_secret: Option<String>,
) -> Result<HelixProfile, String> {
    let profile_id = id.unwrap_or_else(|| {
        format!(
            "profile-{}",
            chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)
        )
    });
    let has_secret = if let Some(secret) = client_secret.filter(|s| !s.is_empty()) {
        keyring::Entry::new(SERVICE, &secret_account(&profile_id))
            .map_err(|e| e.to_string())?
            .set_password(&secret)
            .map_err(|e| format!("No se pudo guardar la clave secreta: {e}"))?;
        true
    } else {
        keyring::Entry::new(SERVICE, &secret_account(&profile_id))
            .ok()
            .and_then(|entry| entry.get_password().ok())
            .is_some()
    };

    let profile = HelixProfile {
        id: profile_id.clone(),
        name: name.trim().to_string(),
        client_id: client_id.trim().to_string(),
        has_secret,
    };

    let mut store = load_store(&app).await?;
    if let Some(idx) = store.profiles.iter().position(|p| p.id == profile_id) {
        store.profiles[idx] = profile.clone();
    } else {
        store.profiles.push(profile.clone());
        if store.active_id.is_none() {
            store.active_id = Some(profile_id);
        }
    }
    save_store(&app, &store).await?;
    *cache().write().await = store;
    Ok(profile)
}

#[tauri::command]
pub async fn delete_helix_profile(app: tauri::AppHandle, id: String) -> Result<(), String> {
    if id == DEFAULT_PROFILE_ID {
        return Err("No se puede eliminar el perfil por defecto del entorno.".into());
    }
    let mut store = load_store(&app).await?;
    store.profiles.retain(|p| p.id != id);
    if store.active_id.as_deref() == Some(id.as_str()) {
        store.active_id = store.profiles.first().map(|p| p.id.clone());
    }
    let _ = keyring::Entry::new(SERVICE, &secret_account(&id))
        .ok()
        .and_then(|entry| entry.delete_credential().ok());
    save_store(&app, &store).await?;
    *cache().write().await = store;
    Ok(())
}

#[tauri::command]
pub async fn set_active_helix_profile(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let mut store = load_store(&app).await?;
    let exists = id == DEFAULT_PROFILE_ID || store.profiles.iter().any(|p| p.id == id);
    if !exists {
        if id == DEFAULT_PROFILE_ID && env_default_profile().is_some() {
            if !store.profiles.iter().any(|p| p.id == DEFAULT_PROFILE_ID) {
                if let Some(default) = env_default_profile() {
                    store.profiles.insert(0, default);
                }
            }
        } else {
            return Err(format!("Perfil de Twitch «{id}» no encontrado"));
        }
    }
    store.active_id = Some(id);
    save_store(&app, &store).await?;
    *cache().write().await = store;
    Ok(())
}

#[allow(dead_code)]
pub fn invalidate_app_token_cache() {
    // Reserved for future token cache invalidation on profile switch.
    let _ = HashMap::<String, String>::new();
}
