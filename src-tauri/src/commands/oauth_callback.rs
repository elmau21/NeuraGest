use std::sync::OnceLock;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::{oneshot, Mutex};

const SUCCESS_HTML: &str = r#"<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>NeuraGest</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #09090b; color: #e4e4e7; display: grid; place-items: center; min-height: 100vh; margin: 0; }
    main { text-align: center; padding: 32px; }
    h1 { color: #9146ff; font-size: 1.25rem; }
    p { color: #a1a1aa; }
  </style>
</head>
<body>
  <main>
    <h1>Sesión iniciada</h1>
    <p>Ya puedes volver a NeuraGest. Esta ventana se puede cerrar.</p>
  </main>
</body>
</html>"#;

struct PendingOAuthListener {
    listener: TcpListener,
    prefix: String,
    port: u16,
}

static PENDING: OnceLock<Mutex<Option<PendingOAuthListener>>> = OnceLock::new();
static ACCEPT_CANCEL: OnceLock<Mutex<Option<oneshot::Sender<()>>>> = OnceLock::new();

fn pending_slot() -> &'static Mutex<Option<PendingOAuthListener>> {
    PENDING.get_or_init(|| Mutex::new(None))
}

fn accept_cancel_slot() -> &'static Mutex<Option<oneshot::Sender<()>>> {
    ACCEPT_CANCEL.get_or_init(|| Mutex::new(None))
}

fn parse_request_path(request: &str, expected_prefix: &str) -> Result<String, String> {
    let first_line = request
        .lines()
        .next()
        .ok_or_else(|| "La solicitud de inicio de sesión llegó vacía.".to_string())?;
    let mut parts = first_line.split_whitespace();
    let method = parts.next().unwrap_or("");
    let path = parts.next().unwrap_or("");
    if method != "GET" {
        return Err("Solo se admite abrir el enlace de retorno en el navegador.".into());
    }
    if !path.starts_with(expected_prefix) {
        tracing::warn!(%path, %expected_prefix, "Ruta de retorno inesperada");
        return Err("La URL de retorno no coincide con la esperada. Vuelve a iniciar sesión.".into());
    }
    Ok(path.to_string())
}

async fn read_request_path(stream: &mut tokio::net::TcpStream, expected_prefix: &str) -> Result<String, String> {
    let mut buffer = [0u8; 8192];
    let read = stream
        .read(&mut buffer)
        .await
        .map_err(|error| {
            tracing::warn!(%error, "Error leyendo retorno de inicio de sesión");
            "No se pudo leer la respuesta de inicio de sesión.".to_string()
        })?;
    if read == 0 {
        return Err("La respuesta de inicio de sesión llegó vacía.".into());
    }
    let request = String::from_utf8_lossy(&buffer[..read]);
    parse_request_path(&request, expected_prefix)
}

async fn write_success_response(stream: &mut tokio::net::TcpStream) -> Result<(), String> {
    let body = SUCCESS_HTML;
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    );
    stream
        .write_all(response.as_bytes())
        .await
        .map_err(|error| {
            tracing::warn!(%error, "Error respondiendo retorno de inicio de sesión");
            "No se pudo confirmar el inicio de sesión.".to_string()
        })?;
    stream
        .shutdown()
        .await
        .map_err(|error| {
            tracing::warn!(%error, "Error cerrando retorno de inicio de sesión");
            "No se pudo cerrar la conexión de inicio de sesión.".to_string()
        })?;
    Ok(())
}

fn bind_failure_message(preferred: u16, last_error: &std::io::Error) -> String {
    let addr = format!("127.0.0.1:{preferred}");
    let kind = last_error.kind();
    if kind == std::io::ErrorKind::AddrInUse {
        format!(
            "No se pudo preparar el retorno de inicio de sesión en {addr}: el puerto está ocupado. \
             Cierra otras ventanas de NeuraGest (dev e instalada a la vez suelen pelearse por el puerto) y vuelve a intentar."
        )
    } else {
        format!(
            "No se pudo preparar el retorno de inicio de sesión en {addr} ({kind}: {last_error})."
        )
    }
}

async fn release_oauth_listener() {
    {
        let mut slot = pending_slot().lock().await;
        if slot.is_some() {
            tracing::info!("Liberando listener OAuth pendiente");
        }
        *slot = None;
    }
    if let Some(tx) = accept_cancel_slot().lock().await.take() {
        tracing::info!("Cancelando accept OAuth en curso");
        let _ = tx.send(());
    }
    // Let the OS release the socket after drop / accept abort.
    tokio::time::sleep(Duration::from_millis(50)).await;
}

/// Bind the loopback listener and remember it. Returns the port actually bound.
/// Call this BEFORE generating the OAuth authorize URL so `redirect_to` matches.
/// Uses only `preferred_port` so Supabase allow-list stays a single known URL.
#[tauri::command]
pub async fn prepare_oauth_callback(
    preferred_port: u16,
    expected_path_prefix: Option<String>,
) -> Result<u16, String> {
    let prefix = expected_path_prefix.unwrap_or_else(|| "/auth/callback".to_string());

    release_oauth_listener().await;

    let mut last_error: Option<std::io::Error> = None;
    for attempt in 0..5u8 {
        match TcpListener::bind(("127.0.0.1", preferred_port)).await {
            Ok(listener) => {
                let bound = listener
                    .local_addr()
                    .map(|addr| addr.port())
                    .unwrap_or(preferred_port);
                tracing::info!(%bound, "Listener OAuth listo");
                *pending_slot().lock().await = Some(PendingOAuthListener {
                    listener,
                    prefix,
                    port: bound,
                });
                return Ok(bound);
            }
            Err(error) => {
                tracing::warn!(port = preferred_port, attempt, %error, "No se pudo abrir puerto OAuth");
                last_error = Some(error);
                tokio::time::sleep(Duration::from_millis(100 + u64::from(attempt) * 50)).await;
            }
        }
    }

    let error = last_error.unwrap_or_else(|| {
        std::io::Error::new(std::io::ErrorKind::Other, "bind OAuth falló sin detalle")
    });
    Err(bind_failure_message(preferred_port, &error))
}

/// Wait for the browser redirect on the listener prepared by `prepare_oauth_callback`.
#[tauri::command]
pub async fn wait_oauth_callback() -> Result<String, String> {
    let pending = {
        let mut slot = pending_slot().lock().await;
        slot.take()
    }
    .ok_or_else(|| {
        "No hay un retorno de inicio de sesión preparado. Vuelve a intentar iniciar sesión.".to_string()
    })?;

    let PendingOAuthListener {
        listener,
        prefix,
        port,
    } = pending;

    let (cancel_tx, cancel_rx) = oneshot::channel::<()>();
    *accept_cancel_slot().lock().await = Some(cancel_tx);

    let accept = tokio::select! {
        result = listener.accept() => {
            *accept_cancel_slot().lock().await = None;
            result.map_err(|error| {
                tracing::warn!(%error, "Error aceptando retorno de inicio de sesión");
                "No se pudo completar el retorno de inicio de sesión.".to_string()
            })?
        }
        _ = cancel_rx => {
            drop(listener);
            return Err("Inicio de sesión cancelado.".into());
        }
        _ = tokio::time::sleep(Duration::from_secs(300)) => {
            *accept_cancel_slot().lock().await = None;
            drop(listener);
            return Err("Tiempo de espera agotado. Vuelve a intentar iniciar sesión.".into());
        }
    };

    let (mut stream, _) = accept;
    let path = read_request_path(&mut stream, &prefix).await?;
    write_success_response(&mut stream).await?;
    Ok(format!("http://127.0.0.1:{port}{path}"))
}

#[tauri::command]
pub async fn cancel_oauth_callback() -> Result<(), String> {
    release_oauth_listener().await;
    Ok(())
}
