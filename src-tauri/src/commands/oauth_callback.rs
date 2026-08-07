use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

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

#[tauri::command]
pub async fn wait_oauth_callback(port: u16, expected_path_prefix: Option<String>) -> Result<String, String> {
    let prefix = expected_path_prefix.unwrap_or_else(|| "/auth/callback".to_string());
    let addr = format!("127.0.0.1:{port}");
    let listener = TcpListener::bind(&addr)
        .await
        .map_err(|error| {
            tracing::warn!(%addr, %error, "Error abriendo puerto local para inicio de sesión");
            format!("No se pudo preparar el retorno de inicio de sesión en {addr}.")
        })?;

    let accept = tokio::time::timeout(Duration::from_secs(300), listener.accept())
        .await
        .map_err(|_| "Tiempo de espera agotado. Vuelve a intentar iniciar sesión.".to_string())?
        .map_err(|error| {
            tracing::warn!(%error, "Error aceptando retorno de inicio de sesión");
            "No se pudo completar el retorno de inicio de sesión.".to_string()
        })?;

    let (mut stream, _) = accept;
    let path = read_request_path(&mut stream, &prefix).await?;
    write_success_response(&mut stream).await?;
    Ok(format!("http://127.0.0.1:{port}{path}"))
}
