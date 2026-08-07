# NeuraGest 1.0.0 — Distribución local (Windows x64)

Build generado el **2026-08-07** con `npm run tauri:build` tras el hotfix de arranque + OAuth ACL (`tauri-plugin-localhost` en `127.0.0.1` + capabilities remotas).

## Instaladores listos (copia fácil)

| Archivo | Tamaño aprox. | Uso recomendado |
|---------|---------------|-----------------|
| `dist-release\NeuraGest_1.0.0_x64-setup.exe` | ~17 MB | **Instalador principal** (NSIS, asistente gráfico) |
| `dist-release\NeuraGest_1.0.0_x64_en-US.msi` | ~21 MB | Despliegue corporativo / GPO / Intune |
| `dist-release\neuragest.exe` | ~37 MB | Ejecutable portable (sin instalador) |

Rutas absolutas:

```
C:\Users\IGNITER\NeuraGest\dist-release\NeuraGest_1.0.0_x64-setup.exe
C:\Users\IGNITER\NeuraGest\dist-release\NeuraGest_1.0.0_x64_en-US.msi
C:\Users\IGNITER\NeuraGest\dist-release\neuragest.exe
```

Los mismos artefactos originales siguen en:

```
C:\Users\IGNITER\NeuraGest\src-tauri\target\release\neuragest.exe
C:\Users\IGNITER\NeuraGest\src-tauri\target\release\bundle\nsis\NeuraGest_1.0.0_x64-setup.exe
C:\Users\IGNITER\NeuraGest\src-tauri\target\release\bundle\msi\NeuraGest_1.0.0_x64_en-US.msi
```

## Hotfix incluido (arranque + login Twitch)

- UI release en `http://127.0.0.1:<puerto>` (bind IPv4 explícito; evita `ERR_CONNECTION_REFUSED` por mismatch `localhost`/IPv6).
- Espera TCP al servidor de assets antes de abrir la ventana.
- Capability remota `http://127.0.0.1:*` / `http://localhost:*` con `allow-app-commands` (incluye `wait_oauth_callback`).
- War Room: embeds Twitch siguen válidos (`parent=127.0.0.1` / `localhost`).

## Cómo instalar (usuario final)

1. Cierra cualquier instancia de NeuraGest en ejecución.
2. Haz doble clic en **`NeuraGest_1.0.0_x64-setup.exe`**.
3. Sigue el asistente (instalación por usuario, sin permisos de admin en la mayoría de equipos).
4. Abre **NeuraGest** desde el menú Inicio o el acceso directo del escritorio.
5. Inicia sesión con Twitch vía Supabase (Ajustes → Integraciones).

Alternativa MSI: doble clic en el `.msi` o `msiexec /i NeuraGest_1.0.0_x64_en-US.msi`.

Portable: ejecuta `neuragest.exe` directamente (no crea accesos directos ni entradas de desinstalación).

## Variables de entorno (`.env`)

**Ya configuradas para este build** (valores embebidos en el binario Tauri en **compile-time** vía `src-tauri/build.rs` → `cargo:rustc-env` + `option_env!` en runtime). El `.exe` **no** necesita un archivo `.env` al lado:

| Variable | Estado |
|----------|--------|
| `VITE_SUPABASE_URL` | OK (frontend Vite + embutido Rust) |
| `VITE_SUPABASE_ANON_KEY` | OK (frontend Vite) |
| `SUPABASE_SERVICE_ROLE_KEY` | OK (embutido Rust) |
| `TWITCH_CLIENT_ID` | OK (embutido Rust) |
| `TWITCH_CLIENT_SECRET` | OK (embutido Rust) |

> Nota: un `.env` junto al exe o en el CWD **sigue pudiendo sobrescribir** estos valores (útil en desarrollo). Sin `.env`, el release usa solo lo embebido al compilar.

**Faltan en tu `.env` (opcionales / manual):**

| Variable | Impacto si falta |
|----------|------------------|
| `GOOGLE_CLIENT_ID` | Google Calendar OAuth no funcionará |
| `GOOGLE_CLIENT_SECRET` | Google Calendar OAuth no funcionará |
| `TWITCHTRACKER_API_KEY` | Solo afecta datos extendidos de TwitchTracker (opcional) |
| `TAURI_SIGNING_PRIVATE_KEY` | Auto-updater no puede firmar releases |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Idem |

Para añadir Google Calendar, pega en `.env` (copia de `.env.example`):

```env
GOOGLE_CLIENT_ID=tu_client_id
GOOGLE_CLIENT_SECRET=tu_client_secret
```

Luego vuelve a ejecutar `npm run build:release` para regenerar instaladores.

## Configuración manual post-instalación

### Twitch OAuth (obligatorio para login)

En **Twitch Developer Console** → OAuth Redirect URLs:

- `https://<TU_PROYECTO>.supabase.co/auth/v1/callback`

En **Supabase Dashboard** → Authentication → URL Configuration → Redirect URLs:

- `http://127.0.0.1:14563/auth/callback`

En **Supabase** → Providers → Twitch: Client ID y Secret (los mismos de `.env`).

Detalle en la app: **Ajustes → Integraciones → Redirects OAuth Twitch**.

### Google Calendar (opcional)

En **Google Cloud Console** → OAuth client (Desktop):

- Redirect URI: `http://127.0.0.1:14564/auth/google/callback`

Variables `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en `.env` + rebuild.

### Auto-updater (no configurado aún)

En `src-tauri/tauri.conf.json` la pubkey sigue en placeholder (`REPLACE_WITH_TAURI_UPDATER_PUBLIC_KEY`) y `endpoints` está vacío. El build **no falla**; en Ajustes → Actualizaciones verás «Updater sin configurar».

Pasos para activarlo después:

```powershell
npm run tauri signer generate -w ~/.tauri/neuragest.key
```

1. Copia la clave pública a `plugins.updater.pubkey` en `tauri.conf.json`.
2. Añade `endpoints` con URL de tu `latest.json`.
3. Publica instaladores firmados con `npm run tauri signer sign --file dist-release\NeuraGest_1.0.0_x64-setup.exe`.

Ver también `docs/RELEASE.md`.

### Firma de código Windows (SmartScreen)

Los instaladores **no están firmados** con certificado EV/OV. Windows puede mostrar «Editor desconocido». Para producción pública:

- Adquirir certificado de firma de código (OV/EV).
- Firmar `.exe` / `.msi` con `signtool` antes de distribuir.

## Regenerar build

```powershell
cd C:\Users\IGNITER\NeuraGest
# Cierra tauri:dev si está corriendo
npm ci
npm run build:release
# Copiar a dist-release (opcional, repetir manualmente o script)
```

## Verificación de este build

- [x] `npm run test` — 39 tests pasados
- [x] `npm run tauri:build` — NSIS + MSI generados
- [x] Copia en `dist-release/`
- [x] Arranque: UI en `http://127.0.0.1:<puerto>` + wait TCP
- [x] OAuth: capability remota con `wait_oauth_callback`
- [x] War Room: parents Twitch `127.0.0.1` / `localhost`
