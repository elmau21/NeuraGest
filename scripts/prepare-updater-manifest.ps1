param(
  [Parameter(Mandatory = $true)]
  [string]$Version,

  [string]$Notes = '',

  [string]$Repo = 'elmau21/NeuraGest',

  [ValidateSet('nsis', 'msi')]
  [string]$Bundle = 'nsis'
)

$ErrorActionPreference = 'Stop'

$tag = if ($Version -match '^v') { $Version } else { "v$Version" }
$semver = $tag.TrimStart('v')
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$bundleDir = Join-Path $repoRoot 'src-tauri\target\release\bundle'

if ($Bundle -eq 'nsis') {
  $bundlePath = Join-Path $bundleDir 'nsis'
  $pattern = "NeuraGest_${semver}_x64-setup.exe"
} else {
  $bundlePath = Join-Path $bundleDir 'msi'
  $pattern = "NeuraGest_${semver}_x64_en-US.msi"
}

$installer = Get-ChildItem -Path $bundlePath -Filter $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $installer) {
  throw "No se encontro el instalador en $bundlePath ($pattern). Ejecuta npm run tauri:build con TAURI_SIGNING_PRIVATE_KEY configurada."
}

$sigFile = "$($installer.FullName).sig"
if (-not (Test-Path $sigFile)) {
  throw "Falta la firma $sigFile. Activa createUpdaterArtifacts y exporta TAURI_SIGNING_PRIVATE_KEY antes del build."
}

$signature = (Get-Content -Raw -Path $sigFile).Trim()
$assetName = $installer.Name
$downloadUrl = "https://github.com/$Repo/releases/download/$tag/$assetName"

$manifest = [ordered]@{
  version  = $semver
  notes    = if ($Notes) { $Notes } else { "NeuraGest $semver" }
  pub_date = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
  platforms = [ordered]@{
    'windows-x86_64' = [ordered]@{
      signature = $signature
      url       = $downloadUrl
    }
  }
}

$outPath = Join-Path $repoRoot 'latest.json'
$manifest | ConvertTo-Json -Depth 6 | Set-Content -Path $outPath -Encoding utf8
Write-Host "Generado $outPath para $downloadUrl"
