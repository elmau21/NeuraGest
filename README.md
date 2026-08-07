# NeuraGest

Aplicación de escritorio de NeuraLive para gestionar talentos Twitch, operaciones, conocimiento y analítica. Funciona en modo demo/offline sin credenciales y sincroniza con Supabase cuando se configura.

## Stack

- Tauri v2 + Rust (NSIS/MSI, updater, notificaciones y logs)
- React 19, TypeScript, Vite 8, Tailwind CSS 4, shadcn/ui, Framer Motion
- Zustand, Recharts, TipTap, dnd-kit
- Supabase PostgreSQL/Auth/Realtime/Storage con RLS
- SQLite local en modo WAL para caché y cola de sincronización
- Twitch OAuth Device Code Flow, Helix y almacenamiento en Windows Credential Manager

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

### Twitch

1. En [Twitch Developer Console](https://dev.twitch.tv/console/apps), pulsa **Register Your Application**. Usa un nombre único, selecciona una categoría (por ejemplo, **Application Integration**) y, si aparece **Client Type**, elige **Confidential**. Pega exactamente esta única OAuth Redirect URL y pulsa **Add** para incorporarla antes de crear la aplicación:

   `https://localhost/oauth/callback`

2. Guarda la aplicación, copia el **Client ID** y pulsa **New Secret**. Completa `.env` sin comillas:

   ```dotenv
   TWITCH_CLIENT_ID=tu_client_id
   TWITCH_CLIENT_SECRET=tu_client_secret
   ```

3. Ejecuta `npm run tauri:dev` y pulsa **Conectar cuenta Twitch**. NeuraGest abrirá `twitch.tv/activate`, esperará la autorización y guardará los tokens en Windows Credential Manager.

La URI HTTPS anterior satisface el formulario de Twitch, pero NeuraGest no recibe tráfico en ella: la autenticación de usuario usa el Device Code Flow oficial y no requiere callback ni servidor local. El App Access Token para las consultas públicas de Helix sigue usando `client_credentials`; este flujo tampoco usa la URI de redirección.

Los scopes de subs/followers dependen de que la cuenta autenticada tenga permisos en los canales. EventSub debe registrar suscripciones por canal tras conectar la cuenta; Twitch entrega actividad por WebSocket y Helix se usa para enriquecimiento.

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

Para publicar auto-updates configura una clave Tauri, agrega `plugins.updater.endpoints` y `plugins.updater.pubkey` a `tauri.conf.json`, firma los artefactos y publica `latest.json`. El plugin está integrado, pero no se incluye una clave ficticia.

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
