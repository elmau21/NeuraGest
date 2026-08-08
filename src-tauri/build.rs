use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// Secrets and public config embedded into the release binary via `cargo:rustc-env`.
/// Runtime still prefers a local `.env` when present (dev / override next to the exe).
const EMBED_KEYS: &[&str] = &[
  "TWITCH_CLIENT_ID",
  "TWITCH_CLIENT_SECRET",
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "TWITCHTRACKER_API_KEY",
  "DISCORD_APPLICATION_ID",
  "DISCORD_CLIENT_ID",
  "NEURALIVE_URL",
  "VITE_NEURALIVE_URL",
  "DISCORD_INVITE_URL",
  "NEURAGEST_DISCORD_INVITE",
  "VITE_DISCORD_INVITE_URL",
];

/// Parse a dotenv file; duplicate keys keep the **last** non-empty value.
fn parse_env_file_last_wins(path: &Path) -> HashMap<String, String> {
  let Ok(raw) = std::fs::read_to_string(path) else {
    return HashMap::new();
  };
  let mut map = HashMap::new();
  for line in raw.lines() {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed.starts_with('#') {
      continue;
    }
    let Some((key, value)) = trimmed.split_once('=') else {
      continue;
    };
    let key = key.trim();
    if key.is_empty() {
      continue;
    }
    let mut value = value.trim().to_string();
    if (value.starts_with('"') && value.ends_with('"'))
      || (value.starts_with('\'') && value.ends_with('\''))
    {
      value = value[1..value.len() - 1].to_string();
    }
    if value.is_empty() {
      continue;
    }
    map.insert(key.to_string(), value);
  }
  map
}

fn main() {
  let manifest_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
  let root_env = manifest_dir.join("..").join(".env");
  let local_env = manifest_dir.join(".env");

  println!("cargo:rerun-if-changed={}", root_env.display());
  println!("cargo:rerun-if-changed={}", local_env.display());

  let file_vars = if root_env.is_file() {
    parse_env_file_last_wins(&root_env)
  } else if local_env.is_file() {
    parse_env_file_last_wins(&local_env)
  } else {
    HashMap::new()
  };

  for key in EMBED_KEYS {
    // Prefer OS/CI env when already set; else last non-empty value from `.env`.
    let value = std::env::var(key)
      .ok()
      .filter(|v| !v.is_empty())
      .or_else(|| file_vars.get(*key).cloned());
    if let Some(value) = value {
      println!("cargo:rustc-env={key}={value}");
    }
  }

  let profile = std::env::var("PROFILE").unwrap_or_default();
  if profile == "release" {
    let mut missing: Vec<&str> = Vec::new();
    for key in ["TWITCH_CLIENT_ID", "TWITCH_CLIENT_SECRET", "SUPABASE_SERVICE_ROLE_KEY"] {
      let present = std::env::var(key)
        .ok()
        .filter(|v| !v.is_empty())
        .is_some()
        || file_vars.get(key).is_some();
      if !present {
        missing.push(key);
      }
    }
    let has_supabase_url = std::env::var("SUPABASE_URL")
      .ok()
      .filter(|v| !v.is_empty())
      .is_some()
      || std::env::var("VITE_SUPABASE_URL")
        .ok()
        .filter(|v| !v.is_empty())
        .is_some()
      || file_vars.contains_key("SUPABASE_URL")
      || file_vars.contains_key("VITE_SUPABASE_URL");
    if !has_supabase_url {
      missing.push("SUPABASE_URL o VITE_SUPABASE_URL");
    }
    if !missing.is_empty() {
      panic!(
        "Build release incompleto: faltan variables en `.env` (raíz del repo o src-tauri/): {}. \
Sin ellas el .exe no podrá hacer login Twitch / Supabase.",
        missing.join(", ")
      );
    }
  }

  tauri_build::build()
}
