# Release y firma — NeuraGest

Guía para builds de producción, auto-updater y firma de código en Windows.

## Prerrequisitos

- Node.js 22+, Rust estable (MSVC), WiX Toolset (Tauri lo gestiona)
- Variables en `.env` (nunca commitear `.env`):

```env
TWITCH_CLIENT_ID=...
TWITCH_CLIENT_SECRET=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
TAURI_SIGNING_PRIVATE_KEY=
TAURI_SIGNING_PRIVATE_KEY_PASSWORD=
```

## Build local

```powershell
npm run test
npm run lint
npm run build:release
```

Scripts disponibles:

| Script | Descripción |
|--------|-------------|
| `npm run build:release` | test + build frontend + Tauri NSIS/MSI |
| `npm run tauri:build` | Solo bundle Tauri (asume `dist/` listo) |
| `npm run build:windows` | Alias de release completo |

Artefactos:

- `src-tauri/target/release/bundle/nsis/NeuraGest_1.0.0_x64-setup.exe`
- `src-tauri/target/release/bundle/msi/NeuraGest_1.0.0_x64_en-US.msi`

## Auto-updater (Tauri v2)

El plugin `@tauri-apps/plugin-updater` ya está integrado. **No hay certificado incluido en el repo.**

### 1. Generar par de claves de firma

```powershell
npm run tauri signer generate -w ~/.tauri/neuragest.key
```

Copia la **clave pública** generada a `plugins.updater.pubkey` en `src-tauri/tauri.conf.json`.
Guarda la clave privada fuera del repo (CI secret `TAURI_SIGNING_PRIVATE_KEY`).

### 2. Configurar endpoints

En `src-tauri/tauri.conf.json`:

```json
"plugins": {
  "updater": {
    "pubkey": "<TU_CLAVE_PUBLICA>",
    "endpoints": [
      "https://releases.neuralive.example/latest.json"
    ],
    "windows": { "installMode": "passive" }
  }
}
```

### 3. Publicar `latest.json`

Ejemplo mínimo (adaptar URLs y checksums reales):

```json
{
  "version": "1.0.1",
  "notes": "Correcciones y mejoras.",
  "pub_date": "2026-08-07T12:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "<firma del .msi o .nsis.zip>",
      "url": "https://releases.neuralive.example/NeuraGest_1.0.1_x64-setup.exe"
    }
  }
}
```

Genera la firma con:

```powershell
npm run tauri signer sign --file path/to/installer.exe
```

### 4. Sin certificado (estado actual)

Hasta que configures pubkey + endpoints + hosting:

- La UI en **Ajustes → Actualizaciones** mostrará que el updater no está configurado.
- Los builds locales funcionan sin firma de updater.
- Para **code signing Windows** (SmartScreen), necesitas un certificado EV/OV de una CA; no se incluye en este repositorio.

## CI (GitHub Actions)

Ver `.github/workflows/ci.yml`: lint, test y build frontend en cada push/PR.
El build Tauri completo puede añadirse en un workflow separado con runner `windows-latest` y secrets de firma.

## Checklist pre-release

- [ ] `npm run test` verde
- [ ] `npm run lint` sin errores
- [ ] Versión bump en `package.json` y `tauri.conf.json`
- [ ] `latest.json` publicado y firmado
- [ ] Probar «Buscar actualizaciones» en Ajustes
