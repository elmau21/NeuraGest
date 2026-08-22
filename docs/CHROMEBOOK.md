# NeuraGest en Chromebook (Linux / Crostini)

NeuraGest se distribuye para Chromebook como paquete **`.deb`** para Linux (Crostini). La instalación es manual: no hay auto-actualización en Linux por ahora.

## Requisitos

| Chromebook | Arquitectura | Paquete disponible |
|------------|--------------|-------------------|
| Intel / AMD (mayoría) | `x86_64` | Sí — `NeuraGest_*_amd64.deb` |
| ARM (algunos modelos) | `aarch64` | No publicado aún — solo builds `x86_64` en CI |

Comprueba tu arquitectura en la terminal de Linux:

```bash
uname -m
# x86_64 = compatible con el .deb actual
# aarch64 = no hay build oficial todavía
```

## 1. Activar Linux (Crostini)

1. Abre **Configuración** del Chromebook.
2. Ve a **Desarrolladores** → **Linux**.
3. Pulsa **Activar** y sigue el asistente (elige un nombre de usuario y espacio en disco).

Cuando termine, se abrirá una terminal Debian. Esa es tu entorno Linux.

## 2. Dependencias del sistema (si hace falta)

En releases recientes de Crostini suele bastar con instalar el `.deb`. Si la app no arranca o faltan librerías WebKit, instala:

```bash
sudo apt update
sudo apt install -y libwebkit2gtk-4.1-0 libayatana-appindicator3-1 librsvg2-2
```

## 3. Descargar el instalador

1. Abre [Releases de NeuraGest](https://github.com/elmau21/NeuraGest/releases/latest) en el navegador del Chromebook.
2. Descarga el archivo **`NeuraGest_*_amd64.deb`** del release más reciente.

Si el repositorio es privado, inicia sesión en GitHub o usa un token con acceso de lectura.

### One-liner (v1.0.10)

```bash
wget -O neuragest.deb "https://github.com/elmau21/NeuraGest/releases/download/v1.0.10/NeuraGest_1.0.10_amd64.deb" && sudo apt install -y ./neuragest.deb
```

## 4. Instalar

En la terminal de Linux, ve a la carpeta de descargas (suele ser `~/Downloads`):

```bash
cd ~/Downloads
sudo apt install ./NeuraGest_*_amd64.deb
```

`apt` resuelve dependencias automáticamente. Si prefieres instalar sin resolver deps:

```bash
sudo dpkg -i NeuraGest_*_amd64.deb
sudo apt install -f
```

## 5. Ejecutar NeuraGest

- Busca **NeuraGest** en el lanzador de aplicaciones de Linux.
- O desde la terminal: `neuragest` (el nombre exacto puede variar según el empaquetado).

## Credenciales y Twitch

En Linux, los tokens de Twitch y Google Calendar se guardan en el **llavero del sistema** (libsecret / GNOME Keyring), equivalente al Credential Manager de Windows.

## Actualizaciones

| Plataforma | Auto-actualización |
|------------|-------------------|
| Windows | Sí — updater Tauri + `latest.json` (`.exe` firmado) |
| Linux / Chromebook | **No** — reinstala el `.deb` nuevo desde GitHub Releases |

El archivo `latest.json` del release solo describe el instalador Windows (`windows-x86_64`). Para actualizar en Chromebook:

1. Descarga el `.deb` de la versión nueva.
2. Ejecuta de nuevo: `sudo apt install ./NeuraGest_*_amd64.deb`

`apt` actualizará el paquete instalado.

## Desarrollo local en Crostini

Si clonas el repositorio y compilas en el Chromebook:

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf \
  libsecret-1-dev \
  curl build-essential

curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# Reinicia la terminal, luego:
npm install
npm run tauri:dev
```

Build de producción:

```bash
npm run build:linux
# Artefacto: src-tauri/target/release/bundle/deb/NeuraGest_*_amd64.deb
```

## Limitaciones conocidas

- Solo **x86_64** en releases automáticos; Chromebooks ARM requieren un runner o build local `aarch64`.
- Sin firma ni auto-update Tauri en `.deb` por ahora.
- Rendimiento: Crostini comparte recursos con Chrome OS; equipos modestos pueden ir más lentos que en Windows nativo.

## Más información

- [Build Windows y releases](RELEASE.md)
- [README principal](../README.md)
