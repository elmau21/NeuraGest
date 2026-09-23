# NeuraGest

Aplicación de escritorio de NeuraLive para gestionar talentos Twitch, operaciones, conocimiento y analítica. Funciona en modo demo/offline sin credenciales y sincroniza con Supabase cuando se configura.

## Stack

- Tauri v2 + Rust (NSIS/MSI en Windows, `.deb` en Linux/Chromebook; updater en Windows)
- React 19, TypeScript, Vite 8, Tailwind CSS 4, shadcn/ui, Framer Motion
- Zustand, Recharts, TipTap, dnd-kit
- Supabase PostgreSQL/Auth/Realtime/Storage con RLS
- SQLite local en modo WAL para caché y cola de sincronización
- Twitch OAuth vía Supabase Auth (callback local Tauri), Helix y almacenamiento seguro (Credential Manager / libsecret)

## Requisitos Windows

- Node.js 22+, npm 11+
- Rust estable con target MSVC
- Visual Studio Build Tools 2022: “Desktop development with C++”
- WebView2 Runtime
- WiX Toolset (Tauri lo descarga cuando corresponde)

## Configuración

```powershell
Copy-Item .env.example .env
npm install
```

Completa `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `TWITCH_CLIENT_ID` y
`TWITCH_CLIENT_SECRET` en `.env`. Las credenciales Twitch se cargan únicamente
en el proceso Rust; después ejecuta `npm run tauri:dev`.

No incluyas secretos en variables `VITE_*`: Vite las publica en el bundle.

### Supabase

1. Crea un proyecto Supabase.
2. Ejecuta `supabase/migrations/202608010001_initial_schema.sql`.
3. Ejecuta `supabase/seed.sql`.
4. Crea el primer usuario en Auth y vincúlalo a la organización `NeuraLive` en `public.users`; asigna el rol `owner` en `user_roles`.
5. Crea buckets privados para `attachments` y `documents` y aplica políticas por organización antes de producción.

La migración incluye UUID/FK, índices, borrado lógico, versionado, triggers, RLS por organización/rol, Realtime, RPC `dashboard_metrics` y la vista materializada `talent_daily_metrics`.

### Twitch (login de usuario vía Supabase Auth)

El login de escritorio usa `signInWithOAuth({ provider: 'twitch' })`. Twitch debe
redirigir **solo** al callback de Supabase; luego Supabase redirige a la app Tauri.

1. En [Twitch Developer Console](https://dev.twitch.tv/console/apps), registra la app
   (categoría p. ej. **Application Integration**; **Client Type** = **Confidential** si aparece).
   En **OAuth Redirect URLs** deja **únicamente**:

   `https://ehxnggopzftiolgapcav.supabase.co/auth/v1/callback`

   No uses `https://localhost/oauth/callback` (basura de docs antiguas; provoca
   `redirect_mismatch` y `ERR_CONNECTION_REFUSED`).

2. Copia el **Client ID**, crea un **New Secret** y pégalos en:
   - `.env` → `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` (Helix / backend Tauri)
   - Supabase Dashboard → **Authentication** → **Providers** → **Twitch** (mismo Client ID/Secret;
     activa el provider)

3. En Supabase → **Authentication** → **URL Configuration**, incluye en Redirect URLs:

   `http://127.0.0.1:14563/auth/callback`

4. Ejecuta `npm run tauri:dev` y pulsa **Continuar con Twitch** **desde la app**.
   No abras un link OAuth suelto ni el generador de tokens de la consola Twitch.

Flujo esperado:

`App` → Supabase `/auth/v1/authorize` → Twitch (`redirect_uri` = callback Supabase) →
Supabase → `http://127.0.0.1:14563/auth/callback` (listener local Tauri).

El App Access Token para Helix público sigue usando `client_credentials` y no usa
redirect. EventSub se registra por canal tras autenticar; Twitch entrega actividad
por WebSocket y Helix se usa para enriquecimiento.

## Desarrollo y pruebas

```powershell
npm run dev          # UI web en modo demo
npm run tauri:dev    # aplicación de escritorio
npm test             # pruebas unitarias
npm run lint
npm run build        # TypeScript + bundle web
```

La UI incluye Dashboard, Talentos, Kanban con drag-and-drop, documentos TipTap, calendario, analítica, ajustes y búsqueda global `Ctrl+K`.

### Contratos locales

Los PDF privados se cargan desde `src/assets/contratos/` y aparecen en **Documentos > Contratos**. Esa carpeta está ignorada por Git: para preparar otra instalación, copia allí los PDF conservando las subcarpetas antes de ejecutar o compilar la aplicación. Si existe una sesión válida de Supabase, la aplicación también intenta sincronizarlos con el bucket privado `documents`; la copia local sigue siendo el respaldo inmediato.

## Build Windows

```powershell
npm run tauri:build
# o validación completa:
npm run build:windows
```

Artefactos esperados:

- `src-tauri/target/release/bundle/nsis/NeuraGest_1.0.0_x64-setup.exe`
- `src-tauri/target/release/bundle/msi/NeuraGest_1.0.0_x64_en-US.msi`

## Build Linux / Chromebook

En Linux (o Crostini en Chromebook Intel/AMD):

```bash
npm run tauri:build:linux
# o validación completa:
npm run build:linux
```

Artefacto: `src-tauri/target/release/bundle/deb/NeuraGest_*_amd64.deb`

Guía de instalación en Chromebook: [docs/CHROMEBOOK.md](docs/CHROMEBOOK.md). El auto-updater Tauri solo aplica a Windows; en Linux reinstala el `.deb` desde Releases.

Para publicar auto-updates con GitHub Releases, sigue [docs/RELEASE.md](docs/RELEASE.md): genera claves Tauri, configura `plugins.updater.pubkey`, secrets de CI y publica con `git tag vX.Y.Z && git push origin vX.Y.Z`. El plugin ya está integrado en Windows; el equipo verá «Hay una actualización disponible» en Ajustes.

## Arquitectura

```text
src/
  data/       seeds demo
  services/   Supabase y puente Twitch/Tauri
  stores/     estado Zustand persistente
  types/      contratos TypeScript
  test/       configuración Vitest
src-tauri/
  src/commands/ OAuth y Helix
  src/db/       SQLite offline
  capabilities/ permisos Tauri
supabase/
  migrations/ esquema, RLS, RPC, triggers
  seed.sql     organización, espacios y talentos
```

## Producción

- Configura buckets y políticas Storage específicas.
- Hospeda endpoint/versiones firmadas del updater.
- Programa refresco de la vista materializada y retención de métricas.
- Ejecuta Helix/EventSub con credenciales reales y valida scopes por broadcaster.
- Revisa advisors de seguridad/rendimiento de Supabase después de aplicar la migración.
- Los datos demo se mantienen locales si no hay variables Supabase; nunca bloquean el arranque.
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
