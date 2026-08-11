# NeuraGest 1.0.2 - Distribución local (Windows x64)

Build generado con `npm run build:release` (tests + lint + Vite + Tauri NSIS/MSI).

## Instaladores listos

| Archivo | Uso recomendado |
|---------|-----------------|
| `dist-release\NeuraGest_1.0.2_x64-setup.exe` | **Instalador principal** (NSIS) |
| `dist-release\NeuraGest_1.0.2_x64_en-US.msi` | Despliegue corporativo / GPO / Intune |
| `dist-release\neuragest.exe` | Ejecutable portable (sin instalador) |

Rutas absolutas:

```
C:\Users\IGNITER\NeuraGest\dist-release\NeuraGest_1.0.2_x64-setup.exe
C:\Users\IGNITER\NeuraGest\dist-release\NeuraGest_1.0.2_x64_en-US.msi
C:\Users\IGNITER\NeuraGest\dist-release\neuragest.exe
```

Orígenes de build:

```
C:\Users\IGNITER\NeuraGest\src-tauri\target\release\neuragest.exe
C:\Users\IGNITER\NeuraGest\src-tauri\target\release\bundle\nsis\NeuraGest_1.0.2_x64-setup.exe
C:\Users\IGNITER\NeuraGest\src-tauri\target\release\bundle\msi\NeuraGest_1.0.2_x64_en-US.msi
```

## Novedades 1.0.2

- NeuraLeague: roles, operaciones y flujo de equipo.
- Diseño: brief creativo, Creative Drive y rol diseñador.
- Channel gaps y reglas de assets Twitch.
- Fixes de analytics / métricas.
- UX sidebar y navegación.
- Permisos ampliados y ajustes Discord / War Room.

## Cómo instalar

1. Cierra cualquier instancia de NeuraGest.
2. Ejecuta `NeuraGest_1.0.2_x64-setup.exe`.
3. Sigue el asistente.
