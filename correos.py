import base64
import json
import os
import smtplib
import ssl
import urllib.request
from email.message import EmailMessage

from database import conectar

# ------------------------------------------------------------
# CONFIGURACIÓN DE ENVÍO
#
# OPCIÓN 1 (recomendada): Resend (funciona en cualquier red,
# viaja por HTTPS puerto 443, nunca lo bloquean):
#   1. Crea cuenta gratis en https://resend.com
#   2. API Keys > Create API Key y copia la clave (re_...)
#   3. En .env define:
#        RESEND_API_KEY=re_xxxxxxxxxxxx
#        RESEND_FROM=Kreditmx <onboarding@resend.dev>
#      (el remitente onboarding@resend.dev solo permite enviar
#       a TU PROPIO correo; para enviar a cualquier cliente
#       agrega y verifica tu dominio en Resend > Domains)
#
# OPCIÓN 2: SMTP directo (Gmail). Requiere que tu red no
# bloquee los puertos 587/465. En .env:
#   SMTP_HOST=smtp.gmail.com
#   SMTP_PORT=587
#   SMTP_USUARIO=tucuenta@gmail.com
#   SMTP_CLAVE=la-contrasena-de-aplicacion
#   SMTP_REMITENTE=Kreditmx <tucuenta@gmail.com>
# ------------------------------------------------------------

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
RESEND_FROM = os.getenv("RESEND_FROM", "Kreditmx <onboarding@resend.dev>")

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USUARIO = os.getenv("SMTP_USUARIO", "")
SMTP_CLAVE = os.getenv("SMTP_CLAVE", "")
SMTP_REMITENTE = os.getenv("SMTP_REMITENTE") or SMTP_USUARIO

ESTADOS = {
    "PENDIENTE": {
        "asunto": "Tu solicitud está pendiente de revisión",
        "titulo": "Solicitud pendiente",
        "color": "#b45309",
        "fondo": "#fef3c7",
        "mensaje": (
            "Hemos recibido tu registro correctamente. Tu solicitud está "
            "<b>pendiente</b> de revisión por parte de nuestro equipo. "
            "Te notificaremos por este medio cuando haya cambios."
        ),
    },
    "EN_REVISION": {
        "asunto": "Tu solicitud está en revisión",
        "titulo": "Solicitud en revisión",
        "color": "#1d4ed8",
        "fondo": "#dbeafe",
        "mensaje": (
            "Buenas noticias: tu solicitud está ahora <b>en revisión</b>. "
            "Estamos verificando tu información y documentos. "
            "Te avisaremos en cuanto tengamos una respuesta."
        ),
    },
    "APROBADO": {
        "asunto": "¡Tu solicitud fue aprobada!",
        "titulo": "Solicitud aprobada",
        "color": "#15803d",
        "fondo": "#dcfce7",
        "mensaje": (
            "¡Felicidades! Tu solicitud fue <b>aprobada</b>. "
            "Nuestro equipo se pondrá en contacto contigo para continuar "
            "con los siguientes pasos."
        ),
    },
    "RECHAZADO": {
        "asunto": "Sobre tu solicitud",
        "titulo": "Solicitud no aprobada",
        "color": "#b91c1c",
        "fondo": "#fee2e2",
        "mensaje": (
            "Lamentablemente tu solicitud no fue aprobada en esta ocasión. "
            "Si crees que se trata de un error, contáctanos para revisar tu caso."
        ),
    },
}


def correo_configurado():
    return bool(RESEND_API_KEY or (SMTP_USUARIO and SMTP_CLAVE))


def obtener_correo_cliente(cliente_id, usuario_id):
    conexion = conectar()
    try:
        cursor = conexion.cursor()
        cursor.execute(
            "SELECT nombre, correo FROM clientes WHERE id = %s AND creado_por = %s",
            (cliente_id, usuario_id),
        )
        return cursor.fetchone()
    finally:
        conexion.close()


def cargar_logo():
    """Devuelve los bytes del logo Kreditmx (o None si no existe)."""
    ruta = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "img", "logo-transparente.png"
    )
    if os.path.exists(ruta):
        with open(ruta, "rb") as archivo:
            return archivo.read()
    return None


def cuerpo_html(nombre, estado, logo_base64=None):
    datos = ESTADOS.get(estado)
    if not datos:
        return None

    # Con Resend no hay adjuntos inline: se usa un enlace de datos.
    origen_logo = (
        f"data:image/png;base64,{logo_base64}" if logo_base64 else None
    )
    etiqueta_logo = (
        f'<img src="{origen_logo}" alt="Kreditmx" width="170" style="display:block; margin:0 auto 6px;">'
        if origen_logo
        else '<span style="color:#ffffff; font-size:26px; font-weight:bold; letter-spacing:1px;">Kreditmx</span>'
    )

    return f"""
<!DOCTYPE html>
<html lang="es">
<body style="margin:0; padding:0; background:#f1f5f9; font-family:Arial, Helvetica, sans-serif;">
    <div style="max-width:520px; margin:24px auto; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e2e8f0;">

        <div style="background:#102a43; padding:24px; text-align:center;">
            {etiqueta_logo}
            <span style="color:#9fb3c8; font-size:12px;">Préstamos y solución financiera</span>
        </div>

        <div style="padding:28px;">
            <h2 style="margin:0 0 6px; color:#102a43;">Hola, {nombre}</h2>
            <p style="margin:0 0 18px; color:#627d98; font-size:14px;">
                Te escribimos para informarte sobre el estado de tu solicitud.
            </p>

            <div style="background:{datos['fondo']}; border-radius:8px; padding:18px; text-align:center;">
                <span style="color:{datos['color']}; font-weight:bold; font-size:16px;">
                    {datos['titulo']}
                </span>
            </div>

            <p style="margin:18px 0 0; color:#334e68; font-size:14px; line-height:1.6;">
                {datos['mensaje']}
            </p>
        </div>

        <div style="background:#f0f4f8; padding:14px; text-align:center;">
            <span style="color:#829ab1; font-size:12px;">
                Este correo fue enviado automáticamente por Kreditmx. No respondas a este mensaje.
            </span>
        </div>

    </div>
</body>
</html>
"""


def enviar_por_resend(nombre, correo, datos_estado, html, logo):
    """Envío vía API HTTPS de Resend (funciona aunque la red bloquee
    los puertos SMTP). Devuelve (enviado, detalle)."""
    cuerpo = {
        "from": RESEND_FROM,
        "to": [correo],
        "subject": f"Kreditmx - {datos_estado['asunto']}",
        "html": html,
        "text": (
            f"Hola {nombre},\n\n"
            f"{datos_estado['mensaje'].replace('<b>', '').replace('</b>', '')}\n\n- Kreditmx"
        ),
    }

    peticion = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(cuerpo).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
            # Cloudflare de Resend bloquea el User-Agent de python-urllib.
            "User-Agent": "Kreditmx/1.0",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(peticion, timeout=25) as respuesta:
            respuesta.read()
        return True, f"Correo enviado a {correo} (Resend)"
    except urllib.error.HTTPError as error:
        detalle = error.read().decode("utf-8", "replace")
        return False, f"Resend rechazó el envío ({error.code}): {detalle}"
    except Exception as error:
        return False, f"No se pudo contactar a Resend: {error}"


def enviar_por_smtp(nombre, correo, datos_estado, html):
    """Envío SMTP directo. Solo funciona si la red no bloquea
    los puertos de correo (587/465)."""
    mensaje = EmailMessage()
    mensaje["Subject"] = f"Kreditmx - {datos_estado['asunto']}"
    mensaje["From"] = SMTP_REMITENTE
    mensaje["To"] = correo
    mensaje.set_content(
        f"Hola {nombre},\n\n{datos_estado['mensaje'].replace('<b>', '').replace('</b>', '')}\n\n- Kreditmx",
        charset="utf-8",
    )
    mensaje.add_alternative(html, subtype="html")

    logo = cargar_logo()
    if logo:
        mensaje.get_payload()[1].add_related(
            logo, maintype="image", subtype="png", cid="logokreditmx"
        )

    contexto = ssl.create_default_context()
    if SMTP_PORT == 465:
        # Puerto 465 usa SSL directo.
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=25, context=contexto) as servidor:
            servidor.login(SMTP_USUARIO, SMTP_CLAVE)
            servidor.send_message(mensaje)
    else:
        # Puerto 587 usa STARTTLS.
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=25) as servidor:
            servidor.starttls(context=contexto)
            servidor.login(SMTP_USUARIO, SMTP_CLAVE)
            servidor.send_message(mensaje)


def enviar_correo_estado(cliente_id, usuario_id, estado):
    """Envía el correo de estado al cliente. Devuelve (enviado, detalle)."""
    datos_estado = ESTADOS.get(estado)
    if not datos_estado:
        return False, f"Estado '{estado}' no tiene correo asociado."

    if not correo_configurado():
        return False, "Correo no configurado (define RESEND_API_KEY o SMTP_USUARIO/SMTP_CLAVE)."

    cliente = obtener_correo_cliente(cliente_id, usuario_id)
    if not cliente:
        return False, "Cliente no encontrado."
    nombre, correo = cliente
    if not correo:
        return False, "El cliente no tiene correo registrado."

    logo = cargar_logo()
    logo_base64 = base64.b64encode(logo).decode("ascii") if logo else None
    html = cuerpo_html(nombre, estado, logo_base64)

    # Preferencia: Resend (HTTPS, funciona en cualquier red).
    if RESEND_API_KEY:
        enviado, detalle = enviar_por_resend(nombre, correo, datos_estado, html, logo)
        if enviado:
            return True, detalle
        print(f"[Kreditmx] Resend falló: {detalle}. Probando SMTP...")

    # Respaldo: SMTP directo.
    if SMTP_USUARIO and SMTP_CLAVE:
        try:
            enviar_por_smtp(nombre, correo, datos_estado, html)
            return True, f"Correo enviado a {correo} (SMTP)"
        except Exception as error:
            return False, f"No se pudo enviar el correo: {error}"

    return False, detalle
