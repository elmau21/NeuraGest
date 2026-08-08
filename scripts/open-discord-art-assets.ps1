# Abre el Developer Portal (Art Assets) y la carpeta de PNGs listos para subir.
# La API de Discord no permite subir Art Assets sin token de bot/sesión; haz Upload manual.
#
# Claves exactas:
#   neuragest.png       → neuragest
#   neuragest-small.png → neuragest_icon
# Cover opcional (invite): neuragest-cover.png 1024×576

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$png = Join-Path $root 'assets\discord\neuragest.png'
$small = Join-Path $root 'assets\discord\neuragest-small.png'
$cover = Join-Path $root 'assets\discord\neuragest-cover.png'
$portal = 'https://discord.com/developers/applications/1535443541634064424/rich-presence/assets'

if (-not (Test-Path $png)) {
  Write-Error "No se encontró $png"
}

Start-Process $portal
Start-Process explorer.exe -ArgumentList "/select,`"$png`""
Write-Host "Large image: clave exacta neuragest"
Write-Host $png
if (Test-Path $small) {
  Write-Host "Small image (badge): clave exacta neuragest_icon"
  Write-Host $small
}
if (Test-Path $cover) {
  Write-Host "Cover invite (opcional): $cover"
}
Write-Host "Tras subir/reemplazar: Salir Discord completo → abrir → NeuraGest Probar estado (cache 5–15 min)."
