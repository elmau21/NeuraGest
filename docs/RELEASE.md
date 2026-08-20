# Release y auto-updater — NeuraGest

Guía para builds de producción, publicación en GitHub Releases y actualizaciones automáticas con Tauri v2.

## ¿Se puede?

**Sí.** NeuraGest ya usa Tauri v2 con `tauri-plugin-updater`. Cuando publiques un release en GitHub, la app instalada comprueba `latest.json`, descarga el `.exe` firmado e instala con un clic — sin repartir zip/rar manualmente.

## Cómo funciona

```text
Owner: git tag v1.0.7 && git push origin v1.0.7
   ↓
GitHub Actions (release.yml): build Windows + firma + latest.json
   ↓
GitHub Release: NeuraGest_1.0.7_x64-setup.exe + latest.json
   ↓
App del equipo: comprueba endpoint → "Hay una actualización disponible" → Actualizar ahora
```

El updater **verifica la firma criptográfica** de cada instalador antes de aplicarlo. Sin clave privada válida no se publica un update confiable.

## Prerrequisitos

- Node.js 22+, Rust estable (MSVC), WiX Toolset (Tauri lo gestiona)
- Repo: `elmau21/NeuraGest` (privado)
- Variables en `.env` local (nunca commitear):

```env
TWITCH_CLIENT_ID=...
TWITCH_CLIENT_SECRET=...
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
TAURI_SIGNING_PRIVATE_KEY=
TAURI_SIGNING_PRIVATE_KEY_PASSWORD=
# Repo privado: token de solo lectura para descargar releases (ver abajo)
VITE_GITHUB_RELEASES_TOKEN=
```

## 1. Generar claves de firma (una sola vez)

```powershell
npm run tauri signer generate -w "$env:USERPROFILE\.tauri\neuragest.key"
```

- **Clave pública** → pégala en `src-tauri/tauri.conf.json` → `plugins.updater.pubkey` (es seguro commitearla).
- **Clave privada** → guárdala en `$env:USERPROFILE\.tauri\neuragest.key` y como secret de GitHub `TAURI_SIGNING_PRIVATE_KEY` (contenido del archivo o ruta). **Nunca** en el repo.

Opcional: secret `TAURI_SIGNING_PUBLIC_KEY` para que CI inyecte la pubkey si aún no la commiteaste.

## 2. Configuración ya integrada

| Archivo | Qué hace |
|---------|----------|
| `src-tauri/tauri.conf.json` | `createUpdaterArtifacts: true`, endpoint GitHub, `installMode: passive` |
| `src-tauri/src/lib.rs` | Plugin updater registrado |
| `src/services/updater.ts` | Comprobar / instalar + token GitHub opcional |
| `src/features/settings/UpdaterPanel.tsx` | UI en Ajustes (español) |
| `src/features/settings/BackgroundUpdater.tsx` | Aviso al iniciar si hay update |
| `.github/workflows/release.yml` | Build + release automático al pushear tag `v*` |

Endpoint configurado:

```text
https://github.com/elmau21/NeuraGest/releases/latest/download/latest.json
```

`latest.json` debe ser **UTF-8 sin BOM**. En Windows, `Set-Content -Encoding utf8` escribe `EF BB BF` y el updater de Tauri falla con `error decoding response body` (GitHub sirve el archivo como `application/octet-stream`; eso es normal y no es la causa). `scripts/prepare-updater-manifest.ps1` ya escribe UTF-8 sin BOM.

El plugin pone `Accept: application/json` al comprobar y `Accept: application/octet-stream` al descargar el `.exe`. No envíes `Accept: application/vnd.github+json` en `check()`: ese media type es de la API de GitHub y puede devolver metadatos del asset en vez del JSON/binario.

## 3. Repo privado y token

Los assets de un repo **privado** requieren autenticación. Opciones:

1. **Recomendado para el equipo:** crear un [PAT fine-grained](https://github.com/settings/tokens?type=beta) con permiso **Contents: Read-only** en `NeuraGest`. Añadirlo al build como `VITE_GITHUB_RELEASES_TOKEN` (secret `GITHUB_RELEASES_TOKEN` en CI). Se embebe en el `.exe` del equipo — aceptable para uso interno; rota el token si alguien deja la agencia.

2. **Alternativa:** repo público solo de releases (`neuragest-releases`) con los `.exe` y `latest.json`, sin token.

3. **Alternativa:** bucket público (Supabase Storage, S3) con `latest.json` + instalador.

Sin token y con repo privado, GitHub redirige a HTML de login y la app muestra `error decoding response body` (el cuerpo no es JSON). El token se pasa como `Authorization: Bearer …` en `check()`; GitHub redirige al CDN (`release-assets.githubusercontent.com`) con un JWT en la query. Eso es el flujo correcto.

Si el decode falla **después** de llegar al CDN, el manifiesto suele tener BOM o no ser JSON válido. Regenera y vuelve a subir solo `latest.json` al release (`gh release upload vX.Y.Z latest.json --clobber`). **No hace falta un .exe nuevo** para ese error.

## 4. Publicar una versión (owner)

### Opción A — GitHub Actions (recomendado)

1. Sube versión en `package.json`, `src-tauri/tauri.conf.json` y `src-tauri/Cargo.toml` (o deja que CI lo haga desde el tag).
2. Commitea la **clave pública** en `tauri.conf.json` si aún dice `REPLACE_WITH_...`.
3. Configura secrets en GitHub → Settings → Secrets:
   - `TAURI_SIGNING_PRIVATE_KEY`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (vacío si no tiene password)
   - `TAURI_SIGNING_PUBLIC_KEY` (opcional)
   - `GITHUB_RELEASES_TOKEN` (PAT read-only para builds del equipo)
   - `TWITCH_*`, `VITE_SUPABASE_*` según el build
4. Crea y pushea el tag:

```powershell
git tag v1.0.7
git push origin v1.0.7
```

5. Actions genera el `.exe`, `.msi`, firmas `.sig` y `latest.json`, y crea el GitHub Release.

### Opción B — Manual local

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content "$env:USERPROFILE\.tauri\neuragest.key" -Raw
npm run build:release
./scripts/prepare-updater-manifest.ps1 -Version "1.0.7" -Notes "Correcciones y mejoras"
gh release create v1.0.7 `
  src-tauri/target/release/bundle/nsis/NeuraGest_1.0.7_x64-setup.exe `
  src-tauri/target/release/bundle/nsis/NeuraGest_1.0.7_x64-setup.exe.sig `
  latest.json `
  --title "NeuraGest v1.0.7" --notes "Release notes aquí"
```

## 5. Experiencia del equipo

- Al abrir NeuraGest: tras ~8 s, toast **«Hay una actualización disponible…»** si hay versión nueva.
- **Ajustes → Actualizaciones:** «Buscar actualizaciones» / **«Actualizar ahora (vX.Y.Z)»**.
- Windows instala en modo pasivo (barra de progreso, sin wizard). Reinicia la app al terminar.

## Build local (sin publicar)

```powershell
npm run build:release
```

Artefactos:

- `src-tauri/target/release/bundle/nsis/NeuraGest_<versión>_x64-setup.exe`
- `src-tauri/target/release/bundle/msi/NeuraGest_<versión>_x64_en-US.msi`
- `.exe.sig` / `.msi.sig` si `TAURI_SIGNING_PRIVATE_KEY` está definida

## CI

- `.github/workflows/ci.yml` — lint, test, build frontend en cada push/PR.
- `.github/workflows/release.yml` — build Windows + GitHub Release en tags `v*`.

## Checklist pre-release

- [ ] `npm run test` y `npm run lint` verdes
- [ ] Versión coherente en `package.json`, `tauri.conf.json`, `Cargo.toml`
- [ ] `plugins.updater.pubkey` con clave real (no el placeholder)
- [ ] Secrets de firma y (si aplica) `GITHUB_RELEASES_TOKEN` en GitHub
- [ ] Tag `vX.Y.Z` pusheado
- [ ] `latest.json` en el release es UTF-8 **sin BOM** (el script ya lo garantiza)
- [ ] Probar «Buscar actualizaciones» en Ajustes con una versión anterior instalada

## Code signing Windows (SmartScreen)

La firma del **updater** (Tauri) es distinta del **code signing** EV/OV de Microsoft. Para reducir avisos de SmartScreen necesitas certificado de CA comercial; no está incluido en este repo.
