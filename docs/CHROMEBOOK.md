# NeuraGest en Chromebook (Linux / Crostini)

NeuraGest se distribuye como paquete `.deb` para entornos Linux de Chromebook (Crostini).

## Requisitos

- Chromebook con soporte de Linux (Crostini) habilitado
- Arquitectura **amd64** (x86_64)

## Instalación rápida

Reemplaza `VERSION` por la versión publicada (por ejemplo `1.0.10`):

```bash
wget -O neuragest.deb "https://github.com/elmau21/NeuraGest/releases/download/vVERSION/NeuraGest_VERSION_amd64.deb" && sudo apt install -y ./neuragest.deb
```

### One-liner (v1.0.10)

```bash
wget -O neuragest.deb "https://github.com/elmau21/NeuraGest/releases/download/v1.0.10/NeuraGest_1.0.10_amd64.deb" && sudo apt install -y ./neuragest.deb
```

## Ejecutar

Tras instalar, abre **NeuraGest** desde el lanzador de aplicaciones de Linux en Chrome OS.

## Actualizaciones

En Chromebook no aplica el auto-updater de Windows. Descarga e instala el `.deb` de la [última release](https://github.com/elmau21/NeuraGest/releases/latest) para actualizar.

## Credenciales

Los tokens de Twitch y Google Calendar se guardan en el llavero del sistema Linux (Secret Service / libsecret), igual que en Windows.
