mod commands;

mod db;

mod twitch;



use std::net::{TcpListener, TcpStream};

use std::time::{Duration, Instant};



use tauri::Manager;

use tauri::{WebviewUrl, WebviewWindowBuilder};



/// Values baked in at compile time by `build.rs` (`cargo:rustc-env` from `.env`).

const EMBEDDED_ENV: &[(&str, Option<&str>)] = &[

  ("TWITCH_CLIENT_ID", option_env!("TWITCH_CLIENT_ID")),

  ("TWITCH_CLIENT_SECRET", option_env!("TWITCH_CLIENT_SECRET")),

  ("SUPABASE_URL", option_env!("SUPABASE_URL")),

  ("VITE_SUPABASE_URL", option_env!("VITE_SUPABASE_URL")),

  ("SUPABASE_SERVICE_ROLE_KEY", option_env!("SUPABASE_SERVICE_ROLE_KEY")),

  ("GOOGLE_CLIENT_ID", option_env!("GOOGLE_CLIENT_ID")),

  ("GOOGLE_CLIENT_SECRET", option_env!("GOOGLE_CLIENT_SECRET")),

  ("TWITCHTRACKER_API_KEY", option_env!("TWITCHTRACKER_API_KEY")),

  ("DISCORD_APPLICATION_ID", option_env!("DISCORD_APPLICATION_ID")),

  ("DISCORD_CLIENT_ID", option_env!("DISCORD_CLIENT_ID")),

  ("NEURALIVE_URL", option_env!("NEURALIVE_URL")),

  ("VITE_NEURALIVE_URL", option_env!("VITE_NEURALIVE_URL")),

  ("DISCORD_INVITE_URL", option_env!("DISCORD_INVITE_URL")),

  ("NEURAGEST_DISCORD_INVITE", option_env!("NEURAGEST_DISCORD_INVITE")),

  ("VITE_DISCORD_INVITE_URL", option_env!("VITE_DISCORD_INVITE_URL")),

];



/// OAuth callback listeners â€” never reuse these for the UI asset server.

const RESERVED_PORTS: &[u16] = &[14563, 14564];

/// Preferred release UI port so the webview origin stays stable when free.

/// Auth tokens are also persisted via Tauri store (not only localStorage).

const PREFERRED_UI_PORT: u16 = 18420;



fn apply_embedded_environment() {

  for (key, value) in EMBEDDED_ENV {

    let Some(value) = value else { continue };

    if std::env::var_os(key).is_none() {

      std::env::set_var(key, value);

    }

  }

}



fn load_environment() {

  // Release/portable exe: credentials come from compile-time embed (no `.env` next to the binary).

  apply_embedded_environment();



  // Dev / optional override: load `.env` from cwd, parent, or next to the executable.

  let mut candidates = Vec::new();

  if let Ok(current_dir) = std::env::current_dir() {

    candidates.push(current_dir.join(".env"));

    candidates.push(current_dir.join("..").join(".env"));

  }

  if let Ok(exe) = std::env::current_exe() {

    if let Some(dir) = exe.parent() {

      candidates.push(dir.join(".env"));

    }

  }

  for path in candidates {

    if path.is_file() {

      let _ = dotenvy::from_path_override(path);

      break;

    }

  }

}



fn port_available(port: u16) -> bool {

  TcpListener::bind(("127.0.0.1", port)).is_ok()

}



fn pick_ui_port() -> u16 {

  if !RESERVED_PORTS.contains(&PREFERRED_UI_PORT) && port_available(PREFERRED_UI_PORT) {

    return PREFERRED_UI_PORT;

  }

  for _ in 0..64 {

    let port = portpicker::pick_unused_port().expect("no hay puerto libre para el servidor local de assets");

    if !RESERVED_PORTS.contains(&port) {

      return port;

    }

  }

  panic!("no hay puerto libre fuera de los reservados para OAuth");

}



/// Wait until the localhost plugin accepts TCP (avoids ERR_CONNECTION_REFUSED race).

fn wait_for_ui_server(port: u16) {

  let addr = format!("127.0.0.1:{port}");

  let deadline = Instant::now() + Duration::from_secs(5);

  while Instant::now() < deadline {

    if TcpStream::connect(&addr).is_ok() {

      return;

    }

    std::thread::sleep(Duration::from_millis(25));

  }

  tracing::warn!(%port, "El servidor de assets no respondiÃ³ a tiempo; la ventana puede fallar al cargar");

}



/// Twitch iframes reject Tauri's default `http://tauri.localhost` origin (HTTPS required

/// except for true localhost). In release we serve assets over `http://127.0.0.1:<port>`.

/// Bind to IPv4 explicitly â€” on Windows `localhost` can resolve to IPv6 while the webview

/// navigates to IPv4 (or the reverse), causing ERR_CONNECTION_REFUSED.

fn build_main_window(app: &tauri::App, port: u16) -> tauri::Result<()> {

  #[cfg(dev)]

  let url = {

    let _ = port;

    WebviewUrl::App(std::path::PathBuf::from("index.html"))

  };



  #[cfg(not(dev))]

  let url = {

    wait_for_ui_server(port);

    let url: tauri::Url = format!("http://127.0.0.1:{port}")

      .parse()

      .expect("URL 127.0.0.1 invÃ¡lida");

    tracing::info!(%port, "Sirviendo UI en 127.0.0.1 para embeds Twitch");

    WebviewUrl::External(url)

  };



  WebviewWindowBuilder::new(app, "main", url)

    .title("NeuraGest")

    .inner_size(1440.0, 900.0)

    .min_inner_size(1100.0, 700.0)

    .center()

    .resizable(true)

    .fullscreen(false)

    .build()?;



  Ok(())

}



#[cfg_attr(mobile, tauri::mobile_entry_point)]

pub fn run() {

  load_environment();

  let file_appender = tracing_appender::rolling::daily(

    std::env::temp_dir().join("NeuraGest").join("logs"),

    "neuragest.log",

  );

  let (writer, guard) = tracing_appender::non_blocking(file_appender);

  Box::leak(Box::new(guard));

  tracing_subscriber::fmt().with_writer(writer).with_env_filter("neuragest=info,warn").init();



  let port = pick_ui_port();



  tauri::Builder::default()

    // Explicit IPv4 host â€” avoids localhost â†’ ::1 vs 127.0.0.1 mismatch on Windows.

    .plugin(tauri_plugin_localhost::Builder::new(port).host("127.0.0.1").build())

    .plugin(tauri_plugin_notification::init())

    .plugin(tauri_plugin_shell::init())

    .plugin(tauri_plugin_store::Builder::default().build())

    .plugin(tauri_plugin_updater::Builder::new().build())

    .setup(move |app| {

      build_main_window(app, port)?;



      let app_dir = app.path().app_data_dir()?;

      std::fs::create_dir_all(&app_dir)?;

      db::initialize(&app_dir.join("neuragest.db"))?;

      tracing::info!("NeuraGest iniciado; cachÃ© SQLite lista");

      let app_handle = app.handle().clone();

      tauri::async_runtime::spawn(async move {

        match commands::refresh_talents(app_handle.clone()).await {

          Ok(talents) => {

            let live_count = talents.iter().filter(|talent| talent.is_live).count();

            tracing::info!(

              talent_count = talents.len(),

              live_count,

              "Refresco Helix inicial completado"

            );

          }

          Err(error) => tracing::warn!(%error, "FallÃ³ el refresco Helix inicial"),

        }

      });

      let eventsub_handle = app.handle().clone();

      tauri::async_runtime::spawn(async move {

        twitch::eventsub::start_eventsub_loop(eventsub_handle).await;

      });

      Ok(())

    })

    .invoke_handler(tauri::generate_handler![

      commands::init_twitch_oauth,

      commands::poll_twitch_oauth,

      commands::start_twitch_oauth,

      commands::store_twitch_oauth_tokens,

      commands::oauth_callback::wait_oauth_callback,

      commands::google_calendar::google_oauth_status,

      commands::google_calendar::google_oauth_begin,

      commands::google_calendar::google_oauth_complete,

      commands::google_calendar::google_oauth_disconnect,

      commands::google_calendar::sync_google_calendar,

      commands::twitch_auth_state,

      commands::disconnect_twitch,

      commands::refresh_talents,

      commands::cached_talents,

      commands::fetch_metric_snapshots,

      commands::fetch_stream_events,

      commands::eventsub_status,

      commands::fetch_weekly_clips,

      commands::fetch_weekly_vods,

      commands::backfill_metrics_clips,

      commands::sync_twitchtracker,

      commands::fetch_twitchtracker_snapshots,

      commands::twitchtracker_sync_status,

      commands::fetch_talent_vods,

      commands::fetch_stream_sessions,

      commands::collect_talent_metrics,

      commands::twitch_profiles::list_helix_profiles,

      commands::twitch_profiles::get_active_helix_profile,

      commands::twitch_profiles::save_helix_profile,

      commands::twitch_profiles::delete_helix_profile,

      commands::twitch_profiles::set_active_helix_profile,

      commands::supabase_bridge::ensure_app_user,

      commands::supabase_bridge::fetch_my_roles,

      commands::supabase_bridge::list_app_users,

      commands::supabase_bridge::set_app_user_roles,

      commands::agency_bridge::list_talent_managers,

      commands::agency_bridge::assign_talent_manager,

      commands::agency_bridge::remove_talent_manager,

      commands::agency_bridge::list_pipeline_items,

      commands::agency_bridge::save_pipeline_item,

      commands::agency_bridge::update_pipeline_status,

      commands::agency_bridge::delete_pipeline_item,

      commands::agency_bridge::list_sponsorship_deals,

      commands::agency_bridge::save_sponsorship_deal,

      commands::agency_bridge::delete_sponsorship_deal,

      commands::agency_bridge::list_onboarding_items,

      commands::agency_bridge::seed_talent_onboarding,

      commands::agency_bridge::toggle_onboarding_item,

      commands::agency_bridge::list_db_talents,

      commands::ops_bridge::list_clips,

      commands::ops_bridge::list_brand_restrictions,

      commands::ops_bridge::save_brand_restriction,

      commands::ops_bridge::delete_brand_restriction,

      commands::ops_bridge::list_commission_entries,

      commands::ops_bridge::save_commission_entry,

      commands::ops_bridge::delete_commission_entry,

      commands::ops_bridge::list_calendar_events_ops,

      commands::usable_bridge::list_rate_cards,

      commands::usable_bridge::save_rate_card,

      commands::usable_bridge::delete_rate_card,

      commands::usable_bridge::list_campaign_briefs,

      commands::usable_bridge::save_campaign_brief,

      commands::usable_bridge::delete_campaign_brief,

      commands::usable_bridge::list_agency_assets,

      commands::usable_bridge::save_agency_asset,

      commands::usable_bridge::delete_agency_asset,

      commands::usable_bridge::list_shift_handoffs,

      commands::usable_bridge::create_shift_handoff,

      commands::usable_bridge::update_handoff_status,

      commands::discord_rpc::discord_rpc_default_application_id,

      commands::discord_rpc::discord_rpc_status,

      commands::discord_rpc::discord_rpc_set_presence,

      commands::discord_rpc::discord_rpc_clear,

      commands::open_twitch_channel_window,

    ])

    .build(tauri::generate_context!())

    .expect("error while building tauri application")

    .run(|_app, event| {
      if let tauri::RunEvent::Exit = event {
        commands::discord_rpc::shutdown();
      }
    });

}


