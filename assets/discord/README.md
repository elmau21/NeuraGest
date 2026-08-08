# Discord Rich Presence — Art Assets

Archivos listos para el Developer Portal:

| Archivo | Tamaño | Clave en el portal | Uso |
|---|---|---|---|
| **`neuragest.png`** | 512×512 | **`neuragest`** | Large image (Activity) |
| **`neuragest-small.png`** | 512×512 | **`neuragest_icon`** | Small image (badge circular) |
| **`neuragest-cover.png`** | 1024×576 | Cover Image | Banner de invite (opcional) |

Logo NeuraLive sobre gradiente púrpura/negro (sin fondo blanco). No rediseña el logo; solo el canvas.

## Subir / reemplazar assets

1. Abre [Art Assets](https://discord.com/developers/applications/1535443541634064424/rich-presence/assets).
2. **Reemplaza** el asset existente `neuragest` con el nuevo `neuragest.png` (fondo oscuro).
3. **Upload Asset** → `neuragest-small.png` → nombre exacto de la clave: **`neuragest_icon`**.
4. (Opcional) Cover Image → `neuragest-cover.png`.

NeuraGest envía `large_image: "neuragest"` y `small_image: "neuragest_icon"` por IPC.

### Si el asset ya está subido y sigue el «?» / fondo blanco viejo

Discord cachea assets **5–15 minutos** (a veces más). En orden:

1. Cierra Discord por completo: bandeja → **Salir**.
2. Vuelve a abrir Discord.
3. NeuraGest → Ajustes → Discord → **Probar estado**.
4. Si falla, espera unos minutos y repite 1–3.

## Botones en el Presence

Sin URL pública no se inventan botones. Opciones:

- Ajustes → Discord → URL del botón (https).
- `.env`: `NEURALIVE_URL` y/o `DISCORD_INVITE_URL` (máx. 2 botones).

## Regenerar PNG

```powershell
python .\scripts\gen-discord-assets.py
.\scripts\open-discord-art-assets.ps1
```
