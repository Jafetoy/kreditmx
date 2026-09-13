# kredimx# kredimx

Sistema de préstamos (Flask + PostgreSQL/Supabase).

## Cómo hacer que el enlace de registro funcione en cualquier dispositivo y red

El enlace de registro se envía al cliente por WhatsApp. Para que funcione desde
**cualquier PC o móvil, en cualquier red** (no solo en tu Wi-Fi), la app debe ser
**accesible desde Internet** y el enlace debe apuntar a esa dirección pública.

### 1. El enlace (código ya listo)

El backend construye el enlace con esta prioridad:

1. `PUBLIC_BASE_URL` (variable de entorno) si está definida.
2. Si no, usa la dirección del navegador (`request.host_url`).

El frontend usa la URL que devuelve el servidor. Por eso, solo hay que definir
`PUBLIC_BASE_URL` con tu dominio o túnel público en el archivo `.env`:

```
PUBLIC_BASE_URL=https://tu-dominio.com
```

### 2. Opciones para publicar la app

Elige una y pon esa dirección en `PUBLIC_BASE_URL`:

- **Hosting en la nube** (recomendado, funciona siempre):
  - Render, Railway, Fly.io o similar. Suben el código y te dan un dominio como
    `https://kreditmx.onrender.com`.
  - Solo define `PUBLIC_BASE_URL=https://kreditmx.onrender.com` y ejecuta con un
    servidor de producción (`gunicorn -w 4 -b 0.0.0.0:5050 app:app`).

- **Dominio propio**:
  - Apunta tu dominio (por ejemplo `kreditmx.com`) al servidor/hosting y define
    `PUBLIC_BASE_URL=https://kreditmx.com`.

- **Túnel temporal** (para probar rápido desde tu PC, sin hosting):
  - Instala ngrok o Cloudflare Tunnel.
  - Con la app corriendo (`python app.py`), expón el puerto:
    - `ngrok http 5050` → te da algo como `https://xxxx.ngrok-free.app`.
  - Pon ese valor en `PUBLIC_BASE_URL`.

### 3. Notas

- La app ya escucha en `0.0.0.0:5050`, por lo que es accesible en la red local,
  pero eso **solo** sirve dentro de la misma Wi-Fi. Para Internet se necesita
  publicarla (paso 2).
- Si `PUBLIC_BASE_URL` queda vacío, el enlace volverá a usar la dirección del
  navegador (útil solo en desarrollo/pruebas locales).
- En producción, usa HTTPS (todos los ejemplos de arriba lo dan).
