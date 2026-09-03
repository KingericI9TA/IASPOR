# IASPOR

App de taller para esquemas, catálogos, albaranes y pedidos FAAC.

## Teléfono

1. Descarga **IASPOR.apk** desde [Releases](https://github.com/KingericI9TA/IASPOR/releases).
2. Ábrelo e instálalo (puede pedir permiso para “orígenes desconocidos”).
3. Entra en IASPOR → **Archivos** → **Elegir carpeta** (la misma de esquemas).

Ahí se guardan pedido, número de albarán y los PDF de albaranes.

Web de respaldo: **https://kingericI9ta.github.io/IASPOR/**

El APK reutiliza la misma firma entre builds: se puede actualizar sin desinstalar. Para dejarla fija del todo, añade en el repo los secretos `ANDROID_KEYSTORE_BASE64` y `ANDROID_KEYSTORE_PASSWORD`.

## Qué hace

- Buscar manuales y esquemas (carpeta del teléfono + Google)
- Catálogos FAAC y Aprimatic
- Despiece / recambios FAAC (caché 12 h)
- Jarvis responde en la app (campo + Grok)
- Códigos (Excel locales)
- Albarán PDF
- Pedido FAAC
- Presupuesto con plantillas locales (Drive opcional)

## Desarrollo

```bash
npm install
npm run dev
```
