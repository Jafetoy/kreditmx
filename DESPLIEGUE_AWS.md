# Despliegue de Kreditmx en AWS

## Recomendación

Desplegar la aplicación Flask en **AWS App Runner** y conservar PostgreSQL en **Supabase**. Así AWS hospeda el sitio y la API, mientras que los datos siguen en la base existente; no hace falta migrar la base a AWS para publicar la aplicación.

## Qué se necesita

| Requisito | Para qué sirve |
|---|---|
| Cuenta AWS con facturación habilitada | Crear y ejecutar el servicio App Runner. |
| Acceso al repositorio GitHub | Conectar App Runner con la rama que se desplegará. |
| Acceso al proyecto Supabase | Obtener la cadena de conexión y ejecutar/verificar el esquema. |
| Dominio propio (opcional) | Usar una URL personalizada en vez del dominio de App Runner. |
| Servicio de correo (opcional) | Enviar notificaciones; se admite Resend o SMTP. |

La arquitectura quedaría así:

```text
Navegador --HTTPS--> AWS App Runner (Flask + Gunicorn) --TLS--> Supabase PostgreSQL
                                             |
                                             +--> Resend o servidor SMTP (opcional)
```

## Configuración que debe prepararse

Guarda estos valores en la configuración segura del servicio de AWS; **no los subas al repositorio ni los pegues en este archivo**.

| Variable | Requerida | Uso |
|---|---:|---|
| `SUPABASE_DB_URL` | Sí | Cadena de conexión PostgreSQL de Supabase. `database.py` la prefiere sobre `DATABASE_URL` y las variables individuales. |
| `SECRET_KEY` | Sí | Clave estable para firmar las sesiones de Flask. Si no se configura, la app genera una nueva al arrancar y las sesiones se invalidan al reiniciar. |
| `PUBLIC_BASE_URL` | Recomendada | URL pública de App Runner o del dominio propio; se usa para formar enlaces de registro. |
| `RESEND_API_KEY` | Opcional | Clave de Resend para correo saliente. |
| `RESEND_FROM` | Opcional | Remitente verificado de Resend. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USUARIO`, `SMTP_CLAVE`, `SMTP_REMITENTE` | Opcionales | Alternativa SMTP si no se usa Resend. |

Para `SECRET_KEY`, genera un valor largo y aleatorio. En AWS, usa secretos/variables de entorno del servicio o AWS Secrets Manager. No reutilices la contraseña de Supabase como clave de Flask. Si se rota la contraseña de la base, actualiza `SUPABASE_DB_URL`, ya que tiene prioridad.

Puedes generar la clave localmente con:

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

Trátala como contraseña y no la agregues a Git.

El puerto debe ser el que configure App Runner. En el arranque de producción, Gunicorn debe escuchar en `0.0.0.0:8080` y el puerto configurado en App Runner debe ser `8080`.

## Cambios necesarios antes de publicar

1. **Usar un servidor WSGI de producción.** El `Procfile` actual ejecuta `python app.py`, que inicia el servidor de desarrollo de Flask. Agrega Gunicorn a `requirements.txt` y configura el servicio para iniciar con:

   ```text
   gunicorn --bind 0.0.0.0:8080 --workers 2 app:app
   ```

2. **Configurar secretos fuera de Git.** `.env` está ignorado por Git y sirve para desarrollo local; App Runner no obtiene automáticamente sus valores. Cárgalos en la configuración de AWS.

3. **Preparar la base de datos.** Verifica que el esquema de `supabase_schema.sql` esté aplicado en Supabase antes de publicar. En una base vacía, primero reordena el esquema: crea `usuarios` antes de `enlaces_registro` y las demás tablas que la referencian. `app.py` también ejecuta `ALTER TABLE`, `CREATE TABLE` y una actualización de datos al arrancar; revisa estas tareas antes de escalar a varias instancias y evita que varios arranques compitan por modificar el esquema.

4. **Cerrar el registro público de administradores.** Actualmente `/registro-admin` y `/api/registro-admin` no requieren iniciar sesión. Antes de exponer el sistema a Internet, limita esa creación a un proceso controlado o protégela para que terceros no puedan crear administradores. Configura también las cookies de sesión como seguras para producción con HTTPS.

5. **Revisar el almacenamiento heredado.** Los documentos nuevos del formulario se guardan como `BYTEA` en Supabase. Las fotos antiguas pueden tener una alternativa de lectura desde la carpeta local `uploads`; migra esos archivos o define almacenamiento persistente, por ejemplo S3. El disco efímero del contenedor no debe ser el único respaldo de archivos.

## Pasos de despliegue en App Runner

1. Confirma los cambios anteriores y que la aplicación arranque localmente con Gunicorn.
2. En App Runner, crea un servicio desde el repositorio y la rama de GitHub que se publicará.
3. Configura la construcción para instalar `requirements.txt` y el comando de inicio de Gunicorn indicado arriba. Si se elige despliegue por contenedor, el repositorio también necesitará un `Dockerfile`.
4. Configura el puerto del servicio como `8080` y agrega las variables/secretos de la tabla anterior.
5. Despliega y revisa los logs de App Runner y CloudWatch; confirma que `/login` carga y prueba inicio de sesión, registro, conexión a Supabase y correo si está habilitado.
6. Configura `PUBLIC_BASE_URL` con la URL pública final. Si usas dominio propio, enlázalo al servicio y verifica HTTPS antes de enviar enlaces a clientes.

## Datos sensibles y operación

El sistema procesa información personal y financiera, incluyendo CURP, domicilio, CLABE, ingresos y documentos de identidad. Antes de usar datos reales, limita el acceso a AWS y Supabase, conserva secretos fuera del código, confirma que HTTPS está activo y define respaldos y retención de datos.

**No se necesita crear una base de datos RDS para esta arquitectura**: Supabase sigue siendo el PostgreSQL del sistema. Si más adelante se decide migrarlo a AWS, eso es un proyecto aparte que requiere plan de migración, respaldo y pruebas de restauración.
