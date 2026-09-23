//! Roster de talentos: prioriza `twitch_user_id` (estable ante renames de login).

use crate::commands::TALENTS;
use crate::commands::supabase_bridge::{supabase_json, supabase_request, DEFAULT_ORG_ID};
use reqwest::Method;
use serde::Deserialize;
use std::collections::HashSet;

#[derive(Debug, Clone)]
pub struct RosterTarget {
    /// Último login conocido (DB o seed hardcode).
    pub login: String,
    /// Id Helix estable; si está presente, Helix se consulta por `id=`.
    pub twitch_user_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TalentRosterRow {
    login: String,
    #[serde(default)]
    twitch_user_id: Option<String>,
}

/// Carga el roster desde `talents` y completa con el seed hardcodeado.
/// Los renames no requieren deploy: basta con tener `twitch_user_id` en DB.
pub async fn load_roster_targets() -> Vec<RosterTarget> {
    let mut targets: Vec<RosterTarget> = Vec::new();
    let mut covered_logins: HashSet<String> = HashSet::new();
    let mut covered_ids: HashSet<String> = HashSet::new();

    match fetch_db_talent_roster().await {
        Ok(rows) => {
            for row in rows {
                let login = row.login.to_lowercase();
                if let Some(id) = row.twitch_user_id.filter(|v| !v.is_empty()) {
                    if covered_ids.insert(id.clone()) {
                        covered_logins.insert(login.clone());
                        targets.push(RosterTarget {
                            login,
                            twitch_user_id: Some(id),
                        });
                    }
                } else if covered_logins.insert(login.clone()) {
                    targets.push(RosterTarget {
                        login,
                        twitch_user_id: None,
                    });
                }
            }
        }
        Err(error) => {
            tracing::warn!(%error, "No se pudo leer roster desde talents; se usa seed hardcode");
        }
    }

    for login in TALENTS {
        let key = (*login).to_lowercase();
        if covered_logins.contains(&key) {
            continue;
        }
        // Puede ser un login obsoleto tras rename: Helix fallará y se omite en refresh.
        covered_logins.insert(key.clone());
        targets.push(RosterTarget {
            login: key,
            twitch_user_id: None,
        });
    }

    targets
}

async fn fetch_db_talent_roster() -> Result<Vec<TalentRosterRow>, String> {
    let query = format!(
        "/rest/v1/talents?select=login,twitch_user_id&organization_id=eq.{DEFAULT_ORG_ID}&deleted_at=is.null"
    );
    let response = supabase_request(Method::GET, &query, None, None, &[]).await?;
    supabase_json(response, "No se pudo leer roster de talentos").await
}

/// Login actual preferido para syncs que aún iteran por login (TwitchTracker, etc.).
pub async fn current_roster_logins() -> Vec<String> {
    load_roster_targets()
        .await
        .into_iter()
        .map(|t| t.login)
        .collect()
}
