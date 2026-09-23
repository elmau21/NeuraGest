//! Helix ops enriquecidos (docs: https://dev.twitch.tv/docs/api/reference/).
//! Canales, clips, suscripciones KPI, chatters, ads y goals.

use crate::commands::{app_access_token, valid_tokens, TALENTS};
use crate::commands::twitch_profiles;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
struct HelixEnvelope<T> {
    data: Vec<T>,
    #[serde(default)]
    total: Option<u64>,
    #[serde(default)]
    points: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct HelixUser {
    id: String,
    login: String,
}

#[derive(Debug, Deserialize)]
struct HelixChannel {
    broadcaster_id: String,
    broadcaster_login: String,
    #[serde(default)]
    broadcaster_language: String,
    #[serde(default)]
    title: String,
    #[serde(default)]
    game_name: String,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    content_classification_labels: Vec<String>,
    #[serde(default)]
    is_branded_content: bool,
}

#[derive(Debug, Deserialize)]
struct HelixClipCreated {
    id: String,
    edit_url: String,
}

#[derive(Debug, Deserialize)]
struct HelixSubscription {
    #[serde(default)]
    tier: String,
    #[serde(default)]
    is_gift: bool,
}

#[derive(Debug, Deserialize)]
struct HelixChatter {
    #[allow(dead_code)]
    user_id: String,
}

#[derive(Debug, Deserialize)]
struct HelixAdSchedule {
    #[serde(default)]
    next_ad_at: Option<String>,
    #[serde(default)]
    last_ad_at: Option<String>,
    #[serde(default)]
    duration: Option<u64>,
    #[serde(default)]
    preroll_free_time: Option<u64>,
    #[serde(default)]
    snooze_count: Option<u64>,
    #[serde(default)]
    snooze_refresh_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct HelixGoal {
    id: String,
    #[serde(rename = "type")]
    goal_type: String,
    #[serde(default)]
    description: String,
    current_amount: i64,
    target_amount: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelInfoRow {
    pub login: String,
    pub broadcaster_id: String,
    pub language: String,
    pub title: String,
    pub game_name: String,
    pub tags: Vec<String>,
    pub content_classification_labels: Vec<String>,
    pub is_branded_content: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatedClipRow {
    pub id: String,
    pub edit_url: String,
    pub url: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionKpiRow {
    pub login: String,
    pub total: u64,
    pub points: u64,
    pub tier1: u64,
    pub tier2: u64,
    pub tier3: u64,
    pub gifts: u64,
    pub available: bool,
    pub note: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChattersRow {
    pub login: String,
    pub chatters: u64,
    pub viewers: u64,
    pub available: bool,
    pub note: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdsScheduleRow {
    pub login: String,
    pub next_ad_at: Option<String>,
    pub last_ad_at: Option<String>,
    pub duration: Option<u64>,
    pub preroll_free_time: Option<u64>,
    pub snooze_count: Option<u64>,
    pub snooze_refresh_at: Option<String>,
    pub available: bool,
    pub note: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatorGoalRow {
    pub id: String,
    pub goal_type: String,
    pub description: String,
    pub current_amount: i64,
    pub target_amount: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoalsRow {
    pub login: String,
    pub goals: Vec<CreatorGoalRow>,
    pub available: bool,
    pub note: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveExtrasRow {
    pub login: String,
    pub channel: Option<ChannelInfoRow>,
    pub chatters: Option<ChattersRow>,
    pub subscriptions: Option<SubscriptionKpiRow>,
    pub ads: Option<AdsScheduleRow>,
    pub goals: Option<GoalsRow>,
}

async fn resolve_user_id(
    client: &reqwest::Client,
    client_id: &str,
    token: &str,
    login: &str,
) -> Result<(String, String), String> {
    let mut url = url::Url::parse("https://api.twitch.tv/helix/users").map_err(|e| e.to_string())?;
    url.query_pairs_mut().append_pair("login", login);
    let response = client
        .get(url)
        .header("Client-Id", client_id)
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("Helix users ({})", response.status()));
    }
    let body: HelixEnvelope<HelixUser> = response.json().await.map_err(|e| e.to_string())?;
    let user = body
        .data
        .into_iter()
        .next()
        .ok_or_else(|| format!("Login Twitch no encontrado: {login}"))?;
    Ok((user.id, user.login))
}

/// GET /helix/channels — tags, idioma, CCL (App Token OK).
pub async fn fetch_channel_info(
    app: &tauri::AppHandle,
    login: &str,
) -> Result<ChannelInfoRow, String> {
    let client_id = twitch_profiles::configured_client_id_for(app).await?;
    let token = app_access_token(app).await?;
    let client = reqwest::Client::new();
    let (broadcaster_id, resolved_login) =
        resolve_user_id(&client, &client_id, &token, login).await?;

    let mut url =
        url::Url::parse("https://api.twitch.tv/helix/channels").map_err(|e| e.to_string())?;
    url.query_pairs_mut()
        .append_pair("broadcaster_id", &broadcaster_id);
    let response = client
        .get(url)
        .header("Client-Id", &client_id)
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("Helix channels ({})", response.status()));
    }
    let body: HelixEnvelope<HelixChannel> = response.json().await.map_err(|e| e.to_string())?;
    let channel = body
        .data
        .into_iter()
        .next()
        .ok_or_else(|| "Canal sin datos Helix".to_string())?;
    Ok(ChannelInfoRow {
        login: resolved_login,
        broadcaster_id: channel.broadcaster_id,
        language: channel.broadcaster_language,
        title: channel.title,
        game_name: channel.game_name,
        tags: channel.tags,
        content_classification_labels: channel.content_classification_labels,
        is_branded_content: channel.is_branded_content,
    })
}

/// Batch GET /helix/channels for roster (App Token).
pub async fn fetch_channels_for_roster(
    app: &tauri::AppHandle,
) -> Result<Vec<ChannelInfoRow>, String> {
    let client_id = twitch_profiles::configured_client_id_for(app).await?;
    let token = app_access_token(app).await?;
    let client = reqwest::Client::new();
    let targets = crate::twitch::roster::load_roster_targets().await;

    let mut users_url =
        url::Url::parse("https://api.twitch.tv/helix/users").map_err(|e| e.to_string())?;
    let mut seen_ids = std::collections::HashSet::new();
    let mut seen_logins = std::collections::HashSet::new();
    let mut appended = 0usize;
    for target in &targets {
        if let Some(id) = target.twitch_user_id.as_deref().filter(|v| !v.is_empty()) {
            if seen_ids.insert(id.to_string()) {
                users_url.query_pairs_mut().append_pair("id", id);
                appended += 1;
            }
        } else if seen_logins.insert(target.login.to_lowercase()) {
            users_url
                .query_pairs_mut()
                .append_pair("login", &target.login);
            appended += 1;
        }
    }
    if appended == 0 {
        return Ok(Vec::new());
    }
    let users_response = client
        .get(users_url)
        .header("Client-Id", &client_id)
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !users_response.status().is_success() {
        return Err(format!("Helix users roster ({})", users_response.status()));
    }
    let users: HelixEnvelope<HelixUser> = users_response.json().await.map_err(|e| e.to_string())?;

    let mut channels_url =
        url::Url::parse("https://api.twitch.tv/helix/channels").map_err(|e| e.to_string())?;
    for user in &users.data {
        channels_url
            .query_pairs_mut()
            .append_pair("broadcaster_id", &user.id);
    }
    let channels_response = client
        .get(channels_url)
        .header("Client-Id", &client_id)
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !channels_response.status().is_success() {
        return Err(format!(
            "Helix channels roster ({})",
            channels_response.status()
        ));
    }
    let channels: HelixEnvelope<HelixChannel> =
        channels_response.json().await.map_err(|e| e.to_string())?;
    Ok(channels
        .data
        .into_iter()
        .map(|channel| ChannelInfoRow {
            login: channel.broadcaster_login,
            broadcaster_id: channel.broadcaster_id,
            language: channel.broadcaster_language,
            title: channel.title,
            game_name: channel.game_name,
            tags: channel.tags,
            content_classification_labels: channel.content_classification_labels,
            is_branded_content: channel.is_branded_content,
        })
        .collect())
}

/// POST /helix/clips — requiere user token con `clips:edit`.
pub async fn create_clip(_app: &tauri::AppHandle, login: &str) -> Result<CreatedClipRow, String> {
    let user_tokens = valid_tokens()
        .await
        .map_err(|_| "Conecta Twitch (OAuth) con scope clips:edit para crear clips.".to_string())?;
    let client_id = user_tokens.client_id.clone();
    let client = reqwest::Client::new();
    let (broadcaster_id, _) =
        resolve_user_id(&client, &client_id, &user_tokens.access_token, login).await?;

    let mut url = url::Url::parse("https://api.twitch.tv/helix/clips").map_err(|e| e.to_string())?;
    url.query_pairs_mut()
        .append_pair("broadcaster_id", &broadcaster_id);
    let response = client
        .post(url)
        .header("Client-Id", &client_id)
        .bearer_auth(&user_tokens.access_token)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("No se pudo crear el clip ({status}): {text}"));
    }
    let body: HelixEnvelope<HelixClipCreated> = response.json().await.map_err(|e| e.to_string())?;
    let clip = body
        .data
        .into_iter()
        .next()
        .ok_or_else(|| "Twitch no devolvió el clip creado".to_string())?;
    Ok(CreatedClipRow {
        url: format!("https://clips.twitch.tv/{}", clip.id),
        id: clip.id,
        edit_url: clip.edit_url,
    })
}

/// GET /helix/subscriptions — KPI tiers (user token del broadcaster o note).
pub async fn fetch_subscription_kpi(
    _app: &tauri::AppHandle,
    login: &str,
) -> Result<SubscriptionKpiRow, String> {
    let user_tokens = match valid_tokens().await {
        Ok(tokens) => tokens,
        Err(_) => {
            return Ok(SubscriptionKpiRow {
                login: login.to_string(),
                total: 0,
                points: 0,
                tier1: 0,
                tier2: 0,
                tier3: 0,
                gifts: 0,
                available: false,
                note: Some(
                    "Requiere OAuth del canal con channel:read:subscriptions.".into(),
                ),
            });
        }
    };
    let oauth_login = user_tokens.login.clone().unwrap_or_default().to_lowercase();
    if !oauth_login.is_empty() && oauth_login != login.to_lowercase() {
        return Ok(SubscriptionKpiRow {
            login: login.to_string(),
            total: 0,
            points: 0,
            tier1: 0,
            tier2: 0,
            tier3: 0,
            gifts: 0,
            available: false,
            note: Some(format!(
                "Sesión Twitch es @{oauth_login}; las subs Helix solo se leen del canal autorizado."
            )),
        });
    }

    let client = reqwest::Client::new();
    let (broadcaster_id, resolved) =
        resolve_user_id(&client, &user_tokens.client_id, &user_tokens.access_token, login).await?;

    let mut url =
        url::Url::parse("https://api.twitch.tv/helix/subscriptions").map_err(|e| e.to_string())?;
    url.query_pairs_mut()
        .append_pair("broadcaster_id", &broadcaster_id);
    url.query_pairs_mut().append_pair("first", "100");
    let response = client
        .get(url)
        .header("Client-Id", &user_tokens.client_id)
        .bearer_auth(&user_tokens.access_token)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Ok(SubscriptionKpiRow {
            login: resolved,
            total: 0,
            points: 0,
            tier1: 0,
            tier2: 0,
            tier3: 0,
            gifts: 0,
            available: false,
            note: Some(format!("Helix subscriptions ({status}): {text}")),
        });
    }
    let body: HelixEnvelope<HelixSubscription> = response.json().await.map_err(|e| e.to_string())?;
    let mut tier1 = 0u64;
    let mut tier2 = 0u64;
    let mut tier3 = 0u64;
    let mut gifts = 0u64;
    for sub in &body.data {
        if sub.is_gift {
            gifts += 1;
        }
        match sub.tier.as_str() {
            "2000" => tier2 += 1,
            "3000" => tier3 += 1,
            _ => tier1 += 1,
        }
    }
    Ok(SubscriptionKpiRow {
        login: resolved,
        total: body.total.unwrap_or(body.data.len() as u64),
        points: body.points.unwrap_or(0),
        tier1,
        tier2,
        tier3,
        gifts,
        available: true,
        note: None,
    })
}

/// GET /helix/chat/chatters — requiere moderator:read:chatters + mod en el canal.
pub async fn fetch_chatters_count(
    _app: &tauri::AppHandle,
    login: &str,
    viewers: u64,
) -> Result<ChattersRow, String> {
    let user_tokens = match valid_tokens().await {
        Ok(tokens) => tokens,
        Err(_) => {
            return Ok(ChattersRow {
                login: login.to_string(),
                chatters: 0,
                viewers,
                available: false,
                note: Some("Conecta Twitch OAuth (moderator:read:chatters).".into()),
            });
        }
    };
    let client = reqwest::Client::new();
    let (broadcaster_id, resolved) =
        resolve_user_id(&client, &user_tokens.client_id, &user_tokens.access_token, login).await?;
    let moderator_id = match fetch_user_profile_id(&client, &user_tokens).await {
        Ok(id) => id,
        Err(err) => {
            return Ok(ChattersRow {
                login: resolved,
                chatters: 0,
                viewers,
                available: false,
                note: Some(err),
            });
        }
    };

    let mut url =
        url::Url::parse("https://api.twitch.tv/helix/chat/chatters").map_err(|e| e.to_string())?;
    url.query_pairs_mut()
        .append_pair("broadcaster_id", &broadcaster_id);
    url.query_pairs_mut()
        .append_pair("moderator_id", &moderator_id);
    url.query_pairs_mut().append_pair("first", "1");
    let response = client
        .get(url)
        .header("Client-Id", &user_tokens.client_id)
        .bearer_auth(&user_tokens.access_token)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Ok(ChattersRow {
            login: resolved,
            chatters: 0,
            viewers,
            available: false,
            note: Some(format!(
                "Chatters no disponible ({status}). ¿Eres mod del canal? {text}"
            )),
        });
    }
    let body: HelixEnvelope<HelixChatter> = response.json().await.map_err(|e| e.to_string())?;
    Ok(ChattersRow {
        login: resolved,
        chatters: body.total.unwrap_or(body.data.len() as u64),
        viewers,
        available: true,
        note: None,
    })
}

async fn fetch_user_profile_id(
    client: &reqwest::Client,
    tokens: &crate::commands::StoredTokens,
) -> Result<String, String> {
    let response = client
        .get("https://api.twitch.tv/helix/users")
        .header("Client-Id", &tokens.client_id)
        .bearer_auth(&tokens.access_token)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("Helix users self ({})", response.status()));
    }
    let body: HelixEnvelope<HelixUser> = response.json().await.map_err(|e| e.to_string())?;
    body.data
        .into_iter()
        .next()
        .map(|u| u.id)
        .ok_or_else(|| "Sin usuario OAuth".into())
}

/// GET /helix/channels/ads — channel:read:ads (solo canal autorizado).
pub async fn fetch_ads_schedule(
    _app: &tauri::AppHandle,
    login: &str,
) -> Result<AdsScheduleRow, String> {
    let user_tokens = match valid_tokens().await {
        Ok(tokens) => tokens,
        Err(_) => {
            return Ok(AdsScheduleRow {
                login: login.to_string(),
                next_ad_at: None,
                last_ad_at: None,
                duration: None,
                preroll_free_time: None,
                snooze_count: None,
                snooze_refresh_at: None,
                available: false,
                note: Some("Requiere OAuth con channel:read:ads.".into()),
            });
        }
    };
    let oauth_login = user_tokens.login.clone().unwrap_or_default().to_lowercase();
    if !oauth_login.is_empty() && oauth_login != login.to_lowercase() {
        return Ok(AdsScheduleRow {
            login: login.to_string(),
            next_ad_at: None,
            last_ad_at: None,
            duration: None,
            preroll_free_time: None,
            snooze_count: None,
            snooze_refresh_at: None,
            available: false,
            note: Some(format!(
                "Ads Helix solo del canal autorizado (@{oauth_login})."
            )),
        });
    }
    let client = reqwest::Client::new();
    let (broadcaster_id, resolved) =
        resolve_user_id(&client, &user_tokens.client_id, &user_tokens.access_token, login).await?;
    let mut url =
        url::Url::parse("https://api.twitch.tv/helix/channels/ads").map_err(|e| e.to_string())?;
    url.query_pairs_mut()
        .append_pair("broadcaster_id", &broadcaster_id);
    let response = client
        .get(url)
        .header("Client-Id", &user_tokens.client_id)
        .bearer_auth(&user_tokens.access_token)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Ok(AdsScheduleRow {
            login: resolved,
            next_ad_at: None,
            last_ad_at: None,
            duration: None,
            preroll_free_time: None,
            snooze_count: None,
            snooze_refresh_at: None,
            available: false,
            note: Some(format!("Ads ({status}): {text}")),
        });
    }
    let body: HelixEnvelope<HelixAdSchedule> = response.json().await.map_err(|e| e.to_string())?;
    let ad = body.data.into_iter().next();
    Ok(AdsScheduleRow {
        login: resolved,
        next_ad_at: ad.as_ref().and_then(|a| a.next_ad_at.clone()),
        last_ad_at: ad.as_ref().and_then(|a| a.last_ad_at.clone()),
        duration: ad.as_ref().and_then(|a| a.duration),
        preroll_free_time: ad.as_ref().and_then(|a| a.preroll_free_time),
        snooze_count: ad.as_ref().and_then(|a| a.snooze_count),
        snooze_refresh_at: ad.as_ref().and_then(|a| a.snooze_refresh_at.clone()),
        available: true,
        note: None,
    })
}

/// GET /helix/goals — channel:read:goals.
pub async fn fetch_creator_goals(
    _app: &tauri::AppHandle,
    login: &str,
) -> Result<GoalsRow, String> {
    let user_tokens = match valid_tokens().await {
        Ok(tokens) => tokens,
        Err(_) => {
            return Ok(GoalsRow {
                login: login.to_string(),
                goals: vec![],
                available: false,
                note: Some("Requiere OAuth con channel:read:goals.".into()),
            });
        }
    };
    let oauth_login = user_tokens.login.clone().unwrap_or_default().to_lowercase();
    if !oauth_login.is_empty() && oauth_login != login.to_lowercase() {
        return Ok(GoalsRow {
            login: login.to_string(),
            goals: vec![],
            available: false,
            note: Some(format!(
                "Goals Helix solo del canal autorizado (@{oauth_login})."
            )),
        });
    }
    let client = reqwest::Client::new();
    let (broadcaster_id, resolved) =
        resolve_user_id(&client, &user_tokens.client_id, &user_tokens.access_token, login).await?;
    let mut url =
        url::Url::parse("https://api.twitch.tv/helix/goals").map_err(|e| e.to_string())?;
    url.query_pairs_mut()
        .append_pair("broadcaster_id", &broadcaster_id);
    let response = client
        .get(url)
        .header("Client-Id", &user_tokens.client_id)
        .bearer_auth(&user_tokens.access_token)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Ok(GoalsRow {
            login: resolved,
            goals: vec![],
            available: false,
            note: Some(format!("Goals ({status}): {text}")),
        });
    }
    let body: HelixEnvelope<HelixGoal> = response.json().await.map_err(|e| e.to_string())?;
    Ok(GoalsRow {
        login: resolved,
        goals: body
            .data
            .into_iter()
            .map(|g| CreatorGoalRow {
                id: g.id,
                goal_type: g.goal_type,
                description: g.description,
                current_amount: g.current_amount,
                target_amount: g.target_amount,
            })
            .collect(),
        available: true,
        note: None,
    })
}

/// Paquete de extras para mosaico live / panel de señales.
pub async fn fetch_live_extras(
    app: &tauri::AppHandle,
    login: &str,
    viewers: u64,
) -> Result<LiveExtrasRow, String> {
    let channel = fetch_channel_info(app, login).await.ok();
    let chatters = fetch_chatters_count(app, login, viewers).await.ok();
    let subscriptions = fetch_subscription_kpi(app, login).await.ok();
    let ads = fetch_ads_schedule(app, login).await.ok();
    let goals = fetch_creator_goals(app, login).await.ok();
    Ok(LiveExtrasRow {
        login: login.to_string(),
        channel,
        chatters,
        subscriptions,
        ads,
        goals,
    })
}

/// KPI de suscripciones activas de TODA la cartera (roster completo, no solo live).
/// Helix exige user token del broadcaster (`channel:read:subscriptions`);
/// cuando hay lectura live se cachea localmente para ir armando el total de cartera.
/// Docs: https://dev.twitch.tv/docs/api/reference/#get-broadcaster-subscriptions
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortfolioSubscriptionKpi {
    pub total: u64,
    pub points: u64,
    pub channels_total: u32,
    pub channels_live: u32,
    pub channels_cached: u32,
    pub channels_missing: u32,
    /// true si al menos un canal tiene lectura live o caché Helix (no inventar 0 de cartera).
    pub has_coverage: bool,
    pub channels: Vec<SubscriptionKpiRow>,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CachedSubscriptionKpi {
    login: String,
    total: u64,
    points: u64,
    tier1: u64,
    tier2: u64,
    tier3: u64,
    gifts: u64,
    captured_at: String,
}

fn subs_cache_key(login: &str) -> String {
    format!("subs-kpi:{}", login.to_lowercase())
}

fn persist_subs_cache(app: &tauri::AppHandle, row: &SubscriptionKpiRow) {
    use tauri::Manager;
    let Ok(app_dir) = app.path().app_data_dir() else {
        return;
    };
    let cached = CachedSubscriptionKpi {
        login: row.login.clone(),
        total: row.total,
        points: row.points,
        tier1: row.tier1,
        tier2: row.tier2,
        tier3: row.tier3,
        gifts: row.gifts,
        captured_at: chrono::Utc::now().to_rfc3339(),
    };
    let _ = crate::db::save_cache(
        &app_dir.join("neuragest.db"),
        &subs_cache_key(&row.login),
        "subscription-kpi",
        &cached,
    );
}

fn read_subs_cache(app: &tauri::AppHandle, login: &str) -> Option<SubscriptionKpiRow> {
    use tauri::Manager;
    let app_dir = app.path().app_data_dir().ok()?;
    let cached: CachedSubscriptionKpi =
        crate::db::read_cache(&app_dir.join("neuragest.db"), &subs_cache_key(login))
            .ok()
            .flatten()?;
    Some(SubscriptionKpiRow {
        login: cached.login,
        total: cached.total,
        points: cached.points,
        tier1: cached.tier1,
        tier2: cached.tier2,
        tier3: cached.tier3,
        gifts: cached.gifts,
        available: true,
        note: Some(format!(
            "Caché Helix ({})",
            &cached.captured_at[..cached.captured_at.len().min(19)]
        )),
    })
}

pub async fn fetch_portfolio_subscription_kpi(
    app: &tauri::AppHandle,
) -> Result<PortfolioSubscriptionKpi, String> {
    let mut channels = Vec::with_capacity(TALENTS.len());
    let mut total = 0u64;
    let mut points = 0u64;
    let mut channels_live = 0u32;
    let mut channels_cached = 0u32;

    for login in TALENTS {
        let live = fetch_subscription_kpi(app, login).await.unwrap_or(SubscriptionKpiRow {
            login: login.to_string(),
            total: 0,
            points: 0,
            tier1: 0,
            tier2: 0,
            tier3: 0,
            gifts: 0,
            available: false,
            note: Some("Sin respuesta Helix.".into()),
        });

        if live.available {
            persist_subs_cache(app, &live);
            total += live.total;
            points += live.points;
            channels_live += 1;
            channels.push(live);
            continue;
        }

        if let Some(cached) = read_subs_cache(app, login) {
            total += cached.total;
            points += cached.points;
            channels_cached += 1;
            channels.push(cached);
            continue;
        }

        channels.push(live);
    }

    let channels_total = TALENTS.len() as u32;
    let covered = channels_live + channels_cached;
    let channels_missing = channels_total.saturating_sub(covered);
    let has_coverage = covered > 0;
    let note = if !has_coverage {
        Some(
            "Suscripciones de cartera aún en recolección por el equipo de Data."
                .to_string(),
        )
    } else if channels_missing > 0 {
        Some(format!(
            "Suscripciones parciales · {covered}/{channels_total} canales."
        ))
    } else {
        None
    };

    Ok(PortfolioSubscriptionKpi {
        total,
        points,
        channels_total,
        channels_live,
        channels_cached,
        channels_missing,
        has_coverage,
        channels,
        note,
    })
}
