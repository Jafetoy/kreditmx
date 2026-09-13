import os
import secrets
import uuid
from datetime import date
import math

from flask import Flask, jsonify, render_template, redirect, request, send_from_directory, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

from database import conectar, inicializar_base
from correos import enviar_correo_estado
from psycopg2 import Binary

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY") or secrets.token_hex(32)

try:
	inicializar_base()
	# Las fotos se guardan DENTRO de la base de datos (Supabase),
	# no en archivos locales.
	conexion = conectar()
	cursor = conexion.cursor()
	cursor.execute(
	"""
	ALTER TABLE clientes
	ADD COLUMN IF NOT EXISTS foto_frente_data BYTEA,
	ADD COLUMN IF NOT EXISTS foto_frente_tipo TEXT,
	ADD COLUMN IF NOT EXISTS foto_reverso_data BYTEA,
		ADD COLUMN IF NOT EXISTS foto_reverso_tipo TEXT,
		ADD COLUMN IF NOT EXISTS correo VARCHAR(150)
	"""
	)
	conexion.commit()

	# Los enlaces guardan quién los generó, para que los clientes que se
	# registran desde el formulario público queden asociados a ese admin.
	cursor.execute(
	    "ALTER TABLE enlaces_registro "
	    "ADD COLUMN IF NOT EXISTS creado_por BIGINT REFERENCES usuarios (id) ON DELETE SET NULL"
	)
	conexion.commit()

	# Reparación: clientes registrados por el formulario público antes de esta
	# corrección quedaron con creado_por NULL y no aparecian en el panel.
	# Se asignan al primer admin (por ahora solo hay un usuario del sistema).
	cursor.execute(
	    "UPDATE clientes SET creado_por = (SELECT MIN(id) FROM usuarios) "
	    "WHERE creado_por IS NULL"
	)
	conexion.commit()

	# Tabla de retiros de inversión (para que la inversión sea editable:
	# agregar, modificar y retirar capital del fondo).
	retiros_sql = (
	"CREATE TABLE IF NOT EXISTS retiros_inversiones ("
	"id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, "
	"creado_por BIGINT REFERENCES usuarios (id) ON DELETE SET NULL, "
	"inversionista VARCHAR(150) NOT NULL DEFAULT 'Inversionista', "
	"monto NUMERIC(12, 2) NOT NULL, "
	"creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()"
	")"
	)
	cursor.execute(retiros_sql)
	conexion.commit()

	# Tabla de retiros de la ganancia del admin (para que pueda retirar
	# lo acumulado en "Para el admin" sin perder el historial).
	ganancias_sql = (
		"CREATE TABLE IF NOT EXISTS retiros_ganancias_admin ("
		"id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, "
		"creado_por BIGINT REFERENCES usuarios (id) ON DELETE SET NULL, "
		"monto NUMERIC(12, 2) NOT NULL, "
		"creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()"
		")"
	)
	cursor.execute(ganancias_sql)
	conexion.commit()
	conexion.close()
	DB_DISPONIBLE = True
except Exception as error:
	print(f"PostgreSQL/Supabase no disponible: {error}")
	DB_DISPONIBLE = False


@app.get("/css/<path:filename>")
def css(filename):
	return send_from_directory("css", filename)


@app.get("/js/<path:filename>")
def javascript(filename):
	return send_from_directory("js", filename)


@app.get("/img/<path:filename>")
def imagen(filename):
	return send_from_directory("img", filename)


@app.get("/uploads/<path:filename>")
def archivo_subido(filename):
	return send_from_directory(app.config["UPLOAD_FOLDER"], filename)


@app.get("/api/clientes/<int:cliente_id>/foto/<lado>")
def foto_cliente(cliente_id, lado):
	"""Sirve la foto guardada en la base de datos."""
	if lado not in ("frente", "reverso"):
		return jsonify({"error": "Lado no válido."}), 400

	columna = f"foto_{lado}"
	conexion = conectar()
	try:
		cursor = conexion.cursor()
		cursor.execute(
		f"SELECT {columna}_data, {columna}_tipo, {columna} FROM clientes "
		"WHERE id = %s AND creado_por = %s",
		(cliente_id, session.get("usuario_id")),
		)
		fila = cursor.fetchone()
	finally:
		conexion.close()

	if not fila:
		return jsonify({"error": "Cliente no encontrado."}), 404

	data, tipo, nombre_archivo = fila

	if data:
		from flask import Response
		return Response(bytes(data), mimetype=tipo or "image/jpeg")

	# Compatibilidad con fotos antiguas guardadas localmente.
	if nombre_archivo:
		ruta_local = os.path.join(app.root_path, "uploads", nombre_archivo)
		if os.path.exists(ruta_local):
			return send_from_directory(os.path.join(app.root_path, "uploads"), nombre_archivo)

	return jsonify({"error": "Foto no disponible."}), 404


def respuesta_base_no_disponible():
	return jsonify({"error": "La base de datos no está disponible."}), 503


# ------------------------------------------------------------
# AUTENTICACIÓN DE ADMINISTRADORES
# ------------------------------------------------------------
def login_requerido(funcion):
	"""Protege rutas: exige sesión iniciada como administrador."""
	from functools import wraps

	@wraps(funcion)
	def envuelto(*argumentos, **kwargs):
		if not session.get("usuario_id"):
			if request.path.startswith("/api/"):
				return jsonify({"error": "No autorizado. Inicia sesión."}), 401
			return redirect(url_for("login"))
		return funcion(*argumentos, **kwargs)

	return envuelto


@app.post("/api/registro-admin")
def registro_admin():
	if not DB_DISPONIBLE:
		return respuesta_base_no_disponible()

	datos = request.get_json(silent=True) or {}
	nombre_completo = (datos.get("nombre_completo") or "").strip()
	usuario = (datos.get("usuario") or "").strip().lower()
	correo = (datos.get("correo") or "").strip().lower()
	contrasena = datos.get("contrasena") or ""

	if not all((nombre_completo, usuario, correo, contrasena)):
		return jsonify({"error": "Completa nombre completo, usuario, correo y contraseña."}), 400
	if len(contrasena) < 8:
		return jsonify({"error": "La contraseña debe tener al menos 8 caracteres."}), 400
	if "@" not in correo or "." not in correo.split("@", 1)[1]:
		return jsonify({"error": "Ingresa un correo válido."}), 400
	if not usuario.replace(".", "").replace("_", "").isalnum():
		return jsonify({"error": "El usuario solo puede tener letras, números, puntos y guiones."}), 400

	conexion = conectar()
	try:
		cursor = conexion.cursor()
		cursor.execute(
			"""
			INSERT INTO usuarios (nombre_completo, usuario, correo, contrasena_hash)
			VALUES (%s, %s, %s, %s)
			RETURNING id
			""",
			(nombre_completo, usuario, correo, generate_password_hash(contrasena)),
		)
		nuevo_id = cursor.fetchone()[0]
		conexion.commit()
	except Exception as error:
		conexion.rollback()
		mensaje = str(error)
		if "usuarios_usuario_key" in mensaje:
			return jsonify({"error": "Ese nombre de usuario ya está registrado."}), 409
		if "usuarios_correo_key" in mensaje:
			return jsonify({"error": "Ese correo ya está registrado."}), 409
		return jsonify({"error": mensaje}), 500
	finally:
		conexion.close()

	return jsonify({"success": True, "usuario_id": nuevo_id}), 201


@app.post("/api/login")
def api_login():
	if not DB_DISPONIBLE:
		return respuesta_base_no_disponible()

	datos = request.get_json(silent=True) or {}
	usuario = (datos.get("usuario") or "").strip().lower()
	contrasena = datos.get("contrasena") or ""

	if not usuario or not contrasena:
		return jsonify({"error": "Ingresa usuario y contraseña."}), 400

	conexion = conectar()
	try:
		cursor = conexion.cursor()
		cursor.execute(
			"SELECT id, contrasena_hash FROM usuarios WHERE usuario = %s OR correo = %s",
			(usuario, usuario),
		)
		fila = cursor.fetchone()
	finally:
		conexion.close()

	if not fila or not check_password_hash(fila[1], contrasena):
		return jsonify({"error": "Usuario o contraseña incorrectos."}), 401

	session["usuario_id"] = fila[0]
	session.permanent = True
	return jsonify({"success": True})


@app.post("/api/logout")
def api_logout():
	session.clear()
	return jsonify({"success": True})


def url_base_publica():
	# URL base para los enlaces que se envian al cliente. Si existe
	# PUBLIC_BASE_URL (dominio o tunel publico) se usa esa; de lo
	# contrario se usa la URL del host actual.
	base = (os.getenv("PUBLIC_BASE_URL") or "").strip().rstrip("/")
	if base:
		return base
	return request.host_url.rstrip("/")


@app.post("/api/enlaces")
@login_requerido
def crear_enlace():
	if not DB_DISPONIBLE:
		return respuesta_base_no_disponible()

	token = secrets.token_urlsafe(24)
	conexion = conectar()

	try:
		cursor = conexion.cursor()
		cursor.execute(
			"INSERT INTO enlaces_registro (token, creado_por) VALUES (%s, %s)",
			(token, session.get("usuario_id")),
		)
		conexion.commit()
	finally:
		conexion.close()

	return jsonify({
		"success": True,
		"token": token,
		"url": f"{url_base_publica()}/registro/{token}",
	})


@app.post("/api/registro")
def crear_cliente():
	if not DB_DISPONIBLE:
		return respuesta_base_no_disponible()

	token = request.form.get("token", "").strip()
	campos = {
		"nombre": request.form.get("nombre", "").strip(),
		"direccion": request.form.get("direccion", "").strip(),
		"telefono": request.form.get("telefono", "").strip(),
		"banco": request.form.get("banco", "").strip(),
		"cuenta": request.form.get("cuenta", "").strip(),
		"correo": request.form.get("correo", "").strip().lower(),
	}
	foto_frente = request.files.get("fotoFrente") or request.files.get("foto_frente")
	foto_reverso = request.files.get("fotoReverso") or request.files.get("foto_reverso")

	if not token or any(not valor for valor in campos.values()) or not foto_frente or not foto_reverso:
		return jsonify({"error": "Completa todos los datos y documentos requeridos."}), 400
	if "@" not in campos["correo"] or "." not in campos["correo"].split("@", 1)[1]:
		return jsonify({"error": "Ingresa un correo electrónico válido."}), 400

	conexion = conectar()

	try:
		cursor = conexion.cursor()
		cursor.execute(
		"SELECT usado, creado_por FROM enlaces_registro WHERE token = %s",
		(token,),
		)
		registro = cursor.fetchone()

		if not registro:
			return jsonify({"error": "El enlace de registro no es válido."}), 404
		if registro[0]:
			return jsonify({"error": "Este enlace de registro ya fue utilizado."}), 409

		# El cliente queda asociado al admin que generó el enlace
		# (la sesión no existe porque el registro es público).
		propietario_id = registro[1] or session.get("usuario_id")

		archivos = []
		for archivo in (foto_frente, foto_reverso):
			# La imagen se guarda COMO DATOS en Supabase, no como archivo local.
			archivos.append((Binary(archivo.read()), archivo.mimetype or "image/jpeg"))

		cursor.execute(
			"""
			INSERT INTO clientes
							(creado_por, nombre, direccion, telefono, banco, cuenta, correo,
							 foto_frente, foto_reverso, foto_frente_data, foto_frente_tipo,
							 foto_reverso_data, foto_reverso_tipo)
						VALUES (%s, %s, %s, %s, %s, %s, %s, '', '', %s, %s, %s, %s)
						RETURNING id
						""",
						 		(
							propietario_id, campos["nombre"], campos["direccion"], campos["telefono"],
							campos["banco"], campos["cuenta"], campos["correo"],
							archivos[0][0], archivos[0][1], archivos[1][0], archivos[1][1],
						),
		)
		nuevo_id = cursor.fetchone()[0]
		cursor.execute(
			"UPDATE enlaces_registro SET usado = TRUE WHERE token = %s",
			(token,),
		)
		conexion.commit()
		exito = True
		excepcion = None
	except Exception as error:
		conexion.rollback()
		exito = False
		excepcion = error
	finally:
		conexion.close()

	if not exito:
		return jsonify({"error": str(excepcion)}), 500

	return jsonify({"success": True, "cliente_id": nuevo_id})


@app.get("/api/admin/resumen")
@login_requerido
def resumen_admin():
	if not DB_DISPONIBLE:
		return respuesta_base_no_disponible()

	conexion = conectar()
	try:
		cursor = conexion.cursor()
		usuario_id = session.get("usuario_id")
		cursor.execute("SELECT COUNT(*) FROM clientes WHERE creado_por = %s", (usuario_id,))
		total_clientes = cursor.fetchone()[0]
		cursor.execute("SELECT COUNT(*) FROM clientes WHERE creado_por = %s AND estado = 'PENDIENTE'", (usuario_id,))
		pendientes = cursor.fetchone()[0]
		cursor.execute("SELECT COUNT(*) FROM clientes WHERE creado_por = %s AND estado = 'EN_REVISION'", (usuario_id,))
		en_revision = cursor.fetchone()[0]
		cursor.execute("SELECT COUNT(*) FROM clientes WHERE creado_por = %s AND estado = 'APROBADO'", (usuario_id,))
		aprobados = cursor.fetchone()[0]
		cursor.execute(
		"SELECT COUNT(DISTINCT cliente_id) FROM prestamos WHERE creado_por = %s AND estado = 'ACTIVO'",
		(usuario_id,),
		)
		clientes_activos = cursor.fetchone()[0]
	finally:
		conexion.close()

	return jsonify({
		"total_clientes": total_clientes,
		"pendientes": pendientes,
		"en_revision": en_revision,
		"aprobados": aprobados,
		"clientes_activos": clientes_activos,
	})


@app.get("/api/clientes")
@login_requerido
def listar_clientes():
	if not DB_DISPONIBLE:
		return respuesta_base_no_disponible()

	conexion = conectar()
	try:
		cursor = conexion.cursor()
		cursor.execute(
			"SELECT id, nombre, direccion, telefono, banco, cuenta, correo, "
			"foto_frente, foto_reverso, estado, creado_en "
			"FROM clientes WHERE creado_por = %s ORDER BY creado_en DESC",
			(session.get("usuario_id"),),
		)
		columnas = (
			"id", "nombre", "direccion", "telefono", "banco", "cuenta", "correo",
			"foto_frente", "foto_reverso", "estado", "creado_en",
		)
		clientes = [dict(zip(columnas, fila)) for fila in cursor.fetchall()]
	finally:
		conexion.close()

	for cliente in clientes:
		cliente["creado_en"] = cliente["creado_en"].isoformat()
		cliente["foto_frente_url"] = f"/api/clientes/{cliente['id']}/foto/frente"
		cliente["foto_reverso_url"] = f"/api/clientes/{cliente['id']}/foto/reverso"

	return jsonify(clientes)


@app.route("/api/clientes/<int:cliente_id>", methods=["PUT", "PATCH"])
@login_requerido
def actualizar_cliente(cliente_id):
	if not DB_DISPONIBLE:
		return respuesta_base_no_disponible()

	datos = request.get_json(silent=True) or {}
	campos_permitidos = ("nombre", "direccion", "telefono", "banco", "cuenta", "correo", "estado")
	actualizaciones = {clave: datos[clave].strip() for clave in campos_permitidos if clave in datos}

	if not actualizaciones:
		return jsonify({"error": "No hay datos para actualizar."}), 400

	set_sql = ", ".join(f"{clave} = %s" for clave in actualizaciones)
	valores = list(actualizaciones.values()) + [cliente_id, session.get("usuario_id")]

	conexion = conectar()
	try:
		cursor = conexion.cursor()
		cursor.execute(
		f"UPDATE clientes SET {set_sql} WHERE id = %s AND creado_por = %s RETURNING id",
		valores,
		)
		fila = cursor.fetchone()
		if not fila:
			return jsonify({"error": "El cliente no existe."}), 404
		conexion.commit()
	except Exception as error:
		conexion.rollback()
		return jsonify({"error": str(error)}), 500
	finally:
		conexion.close()

	respuesta = {"success": True}

	# Si cambió el estado, se notifica al cliente por correo.
	if "estado" in actualizaciones:
		enviado, detalle = enviar_correo_estado(
			cliente_id, session.get("usuario_id"), actualizaciones["estado"]
		)
		print(f"[Kreditmx] Notificación de estado: {detalle}")
		respuesta["correo_enviado"] = enviado
		respuesta["correo_detalle"] = detalle

	return jsonify(respuesta)


@app.delete("/api/clientes/<int:cliente_id>")
@login_requerido
def eliminar_cliente_api(cliente_id):
	if not DB_DISPONIBLE:
		return respuesta_base_no_disponible()

	conexion = conectar()
	try:
		cursor = conexion.cursor()
		cursor.execute(
		"SELECT foto_frente, foto_reverso FROM clientes WHERE id = %s AND creado_por = %s",
		(cliente_id, session.get("usuario_id")),
		)
		fila = cursor.fetchone()
		if not fila:
			return jsonify({"error": "El cliente no existe."}), 404
		# Un cliente con préstamo vigente (ACTIVO) no se puede eliminar.
		cursor.execute(
			"SELECT COUNT(*) FROM prestamos WHERE cliente_id = %s AND estado = 'ACTIVO'",
			(cliente_id,),
		)
		if cursor.fetchone()[0] > 0:
			return jsonify({
			}), 409
		cursor.execute("DELETE FROM clientes WHERE id = %s", (cliente_id,))
		conexion.commit()
	except Exception as error:
		conexion.rollback()
		return jsonify({"error": str(error)}), 500
	finally:
		conexion.close()

	# Las fotos viven en la base de datos: se borran junto con el cliente.
	return jsonify({"success": True})


@app.post("/api/prestamos")
@login_requerido
def crear_prestamo():
	if not DB_DISPONIBLE:
		return respuesta_base_no_disponible()

	datos = request.get_json(silent=True) or {}
	requeridos = ("cliente_id", "monto", "porcentaje", "periodicidad", "numero_pagos", "fecha_inicio")
	if any(dato not in datos for dato in requeridos):
		return jsonify({"error": "Faltan datos del préstamo."}), 400

	monto = float(datos["monto"])
	porcentaje = float(datos["porcentaje"])
	numero_pagos = int(datos["numero_pagos"])
	incremento = (porcentaje / 100) * numero_pagos / 2 * monto
	total = round(monto + incremento)

	conexion = conectar()
	try:
		cursor = conexion.cursor()

		# Un cliente no puede tener mas de un prestamo activo a la vez.
		cursor.execute(
		"SELECT 1 FROM prestamos WHERE cliente_id = %s AND creado_por = %s AND estado = 'ACTIVO' LIMIT 1",
		(int(datos["cliente_id"]), session.get("usuario_id"))
		)
		if cursor.fetchone():
			conexion.close()
			return jsonify({"error": "El cliente ya tiene un prestamo activo."}), 409
		cursor.execute(
			"""
			INSERT INTO prestamos
			(cliente_id, creado_por, monto, porcentaje, total, periodicidad, numero_pagos, fecha_inicio)
			VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
			RETURNING id
			""",
			(
			int(datos["cliente_id"]), session.get("usuario_id"), monto, porcentaje, total,
			datos["periodicidad"], numero_pagos, datos["fecha_inicio"],
		),
		)
		prestamo_id = cursor.fetchone()[0]
		conexion.commit()
	finally:
		conexion.close()

	pago_por_quincena = round(total / numero_pagos)
	return jsonify({
		"success": True,
		"prestamo_id": prestamo_id,
		"incremento": round(incremento),
		"total": total,
		"pago_por_quincena": math.ceil(pago_por_quincena),
	}), 201


@app.post("/api/prestamos/<int:prestamo_id>/cancelar")
@login_requerido
def cancelar_prestamo(prestamo_id):
	# Cancela un prestamo activo. Se conserva el historial de pagos.
	if not DB_DISPONIBLE:
		return respuesta_base_no_disponible()

	conexion = conectar()
	try:
		cursor = conexion.cursor()
		cursor.execute(
		"SELECT estado FROM prestamos WHERE id = %s AND creado_por = %s",
		(prestamo_id, session.get("usuario_id")),
		)
		fila = cursor.fetchone()
		if not fila:
			return jsonify({"error": "El préstamo no existe."}), 404
		if fila[0] != "ACTIVO":
			return jsonify({"error": "El préstamo ya no está activo."}), 409
		cursor.execute(
			"UPDATE prestamos SET estado = 'CANCELADO' WHERE id = %s",
			(prestamo_id,),
		)
		conexion.commit()
	except Exception as error:
		conexion.rollback()
		return jsonify({"error": str(error)}), 500
	finally:
		conexion.close()

	return jsonify({"success": True, "estado": "CANCELADO"})


@app.get("/api/prestamos/<int:prestamo_id>")
@login_requerido
def obtener_prestamo(prestamo_id):
	"""Devuelve los datos editables de un préstamo."""
	if not DB_DISPONIBLE:
		return respuesta_base_no_disponible()

	conexion = conectar()
	try:
		cursor = conexion.cursor()
		cursor.execute(
		"SELECT id, cliente_id, monto, porcentaje, periodicidad, numero_pagos, fecha_inicio, estado "
		"FROM prestamos WHERE id = %s AND creado_por = %s",
		(prestamo_id, session.get("usuario_id")),
		)
		fila = cursor.fetchone()
	finally:
		conexion.close()

	if not fila:
		return jsonify({"error": "El préstamo no existe."}), 404

	return jsonify({
		"id": fila[0],
		"cliente_id": fila[1],
		"monto": float(fila[2]),
		"porcentaje": float(fila[3]),
		"periodicidad": fila[4],
		"numero_pagos": fila[5],
		"fecha_inicio": fila[6].isoformat(),
		"estado": fila[7],
	})


@app.route("/api/prestamos/<int:prestamo_id>", methods=["PUT", "PATCH"])
@login_requerido
def actualizar_prestamo(prestamo_id):
	"""Modifica monto, interés, número de pagos y fecha de un préstamo ACTIVO.
	El total se recalcula igual que al crear el préstamo."""
	if not DB_DISPONIBLE:
		return respuesta_base_no_disponible()

	datos = request.get_json(silent=True) or {}

	conexion = conectar()
	try:
		cursor = conexion.cursor()
		cursor.execute(
		"SELECT estado FROM prestamos WHERE id = %s AND creado_por = %s",
		(prestamo_id, session.get("usuario_id")),
		)
		fila = cursor.fetchone()
		if not fila:
			return jsonify({"error": "El préstamo no existe."}), 404
		if fila[0] != "ACTIVO":
			return jsonify({"error": "Solo se pueden editar préstamos activos."}), 409

		# Valores actuales como base (solo se cambian los campos enviados).
		cursor.execute(
		"SELECT monto, porcentaje, periodicidad, numero_pagos, fecha_inicio "
		"FROM prestamos WHERE id = %s AND creado_por = %s",
		(prestamo_id, session.get("usuario_id")),
		)
		actual = cursor.fetchone()

		try:
			monto = float(datos.get("monto", actual[0]))
			porcentaje = float(datos.get("porcentaje", actual[1]))
			periodicidad = str(datos.get("periodicidad") or actual[2])
			numero_pagos = int(datos.get("numero_pagos", actual[3]))
			fecha_inicio = str(datos.get("fecha_inicio") or actual[4].isoformat())
		except (TypeError, ValueError):
			return jsonify({"error": "Datos del préstamo no válidos."}), 400

		if monto <= 0 or numero_pagos < 1:
			return jsonify({"error": "El monto debe ser mayor a cero y los pagos al menos uno."}), 400
		if periodicidad not in ("quincenal", "mensual"):
			return jsonify({"error": "Periodicidad no válida."}), 400

		# Mismo cálculo que al crear el préstamo.
		incremento = (porcentaje / 100) * numero_pagos / 2 * monto
		total = round(monto + incremento)

		# Si ya hay pagos registrados, el nuevo total no puede ser menor a lo ya pagado.
		cursor.execute(
			"SELECT COALESCE(SUM(monto), 0) FROM pagos WHERE prestamo_id = %s",
			(prestamo_id,),
		)
		total_pagado = float(cursor.fetchone()[0])
		if total < total_pagado:
			return jsonify({"error": f"El nuevo total ({total}) es menor a lo ya pagado ({total_pagado:.2f})."}), 400

		cursor.execute(
			"""
			UPDATE prestamos
			SET monto = %s, porcentaje = %s, total = %s,
			    periodicidad = %s, numero_pagos = %s, fecha_inicio = %s
			WHERE id = %s
			RETURNING id
			""",
			(monto, porcentaje, total, periodicidad, numero_pagos, fecha_inicio, prestamo_id),
		)
		cursor.fetchone()
		conexion.commit()
	except Exception as error:
		conexion.rollback()
		return jsonify({"error": str(error)}), 500
	finally:
		conexion.close()

	return jsonify({
		"success": True,
		"prestamo_id": prestamo_id,
		"total": total,
		"pago_por_periodo": math.ceil(total / numero_pagos),
	})


@app.get("/api/prestamos/activos")
@login_requerido
def listar_prestamos_activos():
	if not DB_DISPONIBLE:
		return respuesta_base_no_disponible()

	conexion = conectar()
	try:
		cursor = conexion.cursor()
		cursor.execute(
			"""
			SELECT p.id, p.cliente_id, c.nombre, p.monto, p.total,
			       p.periodicidad, p.numero_pagos, p.fecha_inicio,
			       COALESCE((SELECT SUM(pg.monto) FROM pagos pg WHERE pg.prestamo_id = p.id), 0) AS pagado
			FROM prestamos p
			JOIN clientes c ON c.id = p.cliente_id
			WHERE p.estado = 'ACTIVO' AND p.creado_por = %s
			ORDER BY p.creado_en DESC
			""",
			(session.get("usuario_id"),),
			)
		columnas = ("id", "cliente_id", "nombre", "monto", "total", "periodicidad", "numero_pagos", "fecha_inicio", "pagado")
		prestamos = [dict(zip(columnas, fila)) for fila in cursor.fetchall()]
	finally:
		conexion.close()

	for prestamo in prestamos:
		prestamo["saldo"] = float(prestamo["total"]) - float(prestamo["pagado"])
		prestamo["monto"] = float(prestamo["monto"])
		prestamo["total"] = float(prestamo["total"])
		prestamo["pagado"] = float(prestamo["pagado"])
		prestamo["fecha_inicio"] = prestamo["fecha_inicio"].isoformat()

	return jsonify(prestamos)


@app.get("/api/prestamos/<int:prestamo_id>/pagos")
@login_requerido
def listar_pagos_prestamo(prestamo_id):
	if not DB_DISPONIBLE:
		return respuesta_base_no_disponible()

	conexion = conectar()
	try:
		cursor = conexion.cursor()
		cursor.execute(
			"SELECT c.nombre, p.total, p.numero_pagos, p.fecha_inicio "
			"FROM prestamos p JOIN clientes c ON c.id = p.cliente_id "
			"WHERE p.id = %s AND p.creado_por = %s",
			(prestamo_id, session.get("usuario_id")),
		)
		prestamo = cursor.fetchone()
		if not prestamo:
			return jsonify({"error": "El préstamo no existe."}), 404

		cursor.execute(
			"SELECT numero_pago, fecha_pago, monto, saldo_anterior, nuevo_saldo "
			"FROM pagos WHERE prestamo_id = %s ORDER BY numero_pago",
			(prestamo_id,),
		)
		pagos = [
			{
				"numero_pago": fila[0],
				"fecha_pago": fila[1].isoformat(),
				"monto": float(fila[2]),
				"saldo_anterior": float(fila[3]),
				"nuevo_saldo": float(fila[4]),
			}
			for fila in cursor.fetchall()
		]
	finally:
		conexion.close()

	return jsonify({
		"cliente": prestamo[0],
		"total": float(prestamo[1]),
		"numero_pagos": prestamo[2],
		"fecha_inicio": prestamo[3].isoformat(),
		"pagos": pagos,
	})


@app.post("/api/pagos")
@login_requerido
def crear_pago():
	if not DB_DISPONIBLE:
		return respuesta_base_no_disponible()

	datos = request.get_json(silent=True) or {}
	requeridos = ("prestamo_id", "numero_pago", "fecha_pago", "monto")
	if any(dato not in datos for dato in requeridos):
		return jsonify({"error": "Faltan datos del pago."}), 400

	conexion = conectar()
	try:
		cursor = conexion.cursor()
		cursor.execute(
		"SELECT total FROM prestamos WHERE id = %s AND creado_por = %s AND estado = 'ACTIVO'",
		(int(datos["prestamo_id"]), session.get("usuario_id")),
		)
		prestamo = cursor.fetchone()
		if not prestamo:
			return jsonify({"error": "El préstamo activo no existe."}), 404

		cursor.execute(
			"SELECT COALESCE(SUM(monto), 0) FROM pagos WHERE prestamo_id = %s",
			(int(datos["prestamo_id"]),),
		)
		total_pagado = float(cursor.fetchone()[0])
		saldo_anterior = float(prestamo[0]) - total_pagado
		monto = float(datos["monto"])
		if monto <= 0 or monto > saldo_anterior:
			return jsonify({"error": "El monto supera el saldo pendiente o no es válido."}), 400

		nuevo_saldo = round(saldo_anterior - monto)
		cursor.execute(
			"""
			INSERT INTO pagos
			(prestamo_id, numero_pago, fecha_pago, monto, saldo_anterior, nuevo_saldo)
			VALUES (%s, %s, %s, %s, %s, %s)
			RETURNING id
			""",
			(
				int(datos["prestamo_id"]), int(datos["numero_pago"]),
				datos["fecha_pago"], monto, saldo_anterior, nuevo_saldo,
			),
		)
		pago_id = cursor.fetchone()[0]
		if nuevo_saldo == 0:
			cursor.execute(
				"UPDATE prestamos SET estado = 'LIQUIDADO' WHERE id = %s",
				(int(datos["prestamo_id"]),),
			)

		# Reparto del pago entre inversionista, fondo y admin.
		porcentajes = obtener_porcentajes(cursor)
		reparto_inversionista = round(monto * porcentajes["inversionista"] / 100, 2)
		reparto_fondo = round(monto * porcentajes["fondo"] / 100, 2)
		reparto_admin = round(monto - reparto_inversionista - reparto_fondo, 2)

		conexion.commit()
		cursor.execute(
			"""
			INSERT INTO distribucion_pagos (pago_id, inversionista, fondo, admin)
			VALUES (%s, %s, %s, %s)
			""",
			(pago_id, reparto_inversionista, reparto_fondo, reparto_admin),
		)
		conexion.commit()
	finally:
		conexion.close()

	return jsonify({
		"success": True,
		"pago_id": pago_id,
		"saldo": nuevo_saldo,
		"reparto": {
			"inversionista": reparto_inversionista,
			"fondo": reparto_fondo,
			"admin": reparto_admin,
		},
	}), 201


PORCENTAJES_DEFAULT = {"inversionista": 60, "fondo": 20, "admin": 20}


def obtener_porcentajes(cursor):
	"""Lee los porcentajes de reparto configurados (o usa los default)."""
	porcentajes = dict(PORCENTAJES_DEFAULT)
	cursor.execute("SELECT clave, valor FROM configuracion")
	for clave, valor in cursor.fetchall():
		if clave in porcentajes:
			porcentajes[clave] = float(valor)
	return porcentajes


@app.get("/api/usuarios/me")
@login_requerido
def usuario_actual():
	"""Datos del usuario en sesión, para el mensaje de bienvenida."""
	if not DB_DISPONIBLE:
		return respuesta_base_no_disponible()

	conexion = conectar()
	try:
		cursor = conexion.cursor()
		cursor.execute(
			"SELECT nombre_completo, usuario FROM usuarios WHERE id = %s",
			(session.get("usuario_id"),),
		)
		fila = cursor.fetchone()
	finally:
		conexion.close()

	if not fila:
		return jsonify({"error": "Usuario no encontrado."}), 404

	return jsonify({"nombre_completo": fila[0], "usuario": fila[1]})


@app.get("/api/fondo")
@login_requerido
def estado_fondo():
	if not DB_DISPONIBLE:
		return respuesta_base_no_disponible()

	conexion = conectar()
	try:
		cursor = conexion.cursor()

		usuario_id = session.get("usuario_id")

		cursor.execute("SELECT COALESCE(SUM(monto), 0) FROM inversiones WHERE creado_por = %s", (usuario_id,))
		total_invertido_bruto = float(cursor.fetchone()[0])

		cursor.execute("SELECT COALESCE(SUM(monto), 0) FROM retiros_inversiones WHERE creado_por = %s", (usuario_id,))
		total_retirado = float(cursor.fetchone()[0])

		# El capital invertido es lo aportado menos lo retirado.
		total_invertido = total_invertido_bruto - total_retirado
		# Solo cuenta el dinero prestado actualmente vigente (préstamos ACTIVO).
		# Los préstamos cancelados o liquidados no se descuentan del fondo.
		cursor.execute(
			"SELECT COALESCE(SUM(monto), 0) FROM prestamos WHERE creado_por = %s AND estado = 'ACTIVO'",
			(usuario_id,),
		)
		prestado = float(cursor.fetchone()[0])

		cursor.execute(
		"SELECT COALESCE(SUM(d.inversionista), 0), COALESCE(SUM(d.fondo), 0), "
		"COALESCE(SUM(d.admin), 0) FROM distribucion_pagos d "
		"JOIN pagos pg ON pg.id = d.pago_id "
		"JOIN prestamos p ON p.id = pg.prestamo_id "
		"WHERE p.creado_por = %s AND p.estado = 'ACTIVO'",
		(usuario_id,),
		)
		fila = cursor.fetchone()
		para_inversionista = float(fila[0])
		para_fondo = float(fila[1])
		para_admin = float(fila[2])

		# Lo que el admin ya retiró no cuenta como acumulado pendiente.
		cursor.execute(
		"SELECT COALESCE(SUM(monto), 0) FROM retiros_ganancias_admin WHERE creado_por = %s",
		(usuario_id,),
		)
		ganancia_ya_retirada = float(cursor.fetchone()[0])
		para_admin = max(para_admin - ganancia_ya_retirada, 0)

		porcentajes = obtener_porcentajes(cursor)
	finally:
		conexion.close()

	# El fondo disponible crece con la parte del pago asignada al fondo.
	fondo_disponible = total_invertido - prestado + para_fondo
	ganancia_admin_disponible = para_admin

	return jsonify({
	"total_invertido": total_invertido,
	"total_aportado": total_invertido_bruto,
	"total_retirado": total_retirado,
	"prestado": prestado,
	"fondo_disponible": fondo_disponible,
	"para_inversionista": para_inversionista,
	"para_fondo": para_fondo,
	"para_admin": para_admin,
	"ganancia_admin_disponible": ganancia_admin_disponible,
	"porcentajes": porcentajes,
	})


@app.post("/api/inversiones")
@login_requerido
def crear_inversion():
	if not DB_DISPONIBLE:
		return respuesta_base_no_disponible()

	datos = request.get_json(silent=True) or {}
	monto = float(datos.get("monto") or 0)
	inversionista = (datos.get("inversionista") or "Inversionista").strip()

	if monto <= 0:
		return jsonify({"error": "Ingresa un monto de inversión válido."}), 400

	conexion = conectar()
	try:
		cursor = conexion.cursor()
		cursor.execute(
			"INSERT INTO inversiones (creado_por, inversionista, monto) VALUES (%s, %s, %s) RETURNING id",
			(session.get("usuario_id"), inversionista or "Inversionista", monto),
		)
		conexion.commit()
		inversion_id = cursor.fetchone()[0]
	finally:
		conexion.close()

	return jsonify({"success": True, "inversion_id": inversion_id}), 201


@app.get("/api/inversiones")
@login_requerido
def listar_inversiones():
	if not DB_DISPONIBLE:
		return respuesta_base_no_disponible()

	conexion = conectar()
	try:
		cursor = conexion.cursor()
		cursor.execute(
			"SELECT id, inversionista, monto, creado_en FROM inversiones "
			"WHERE creado_por = %s ORDER BY creado_en DESC",
			(session.get("usuario_id"),),
		)
		columnas = ("id", "inversionista", "monto", "creado_en")
		inversiones = [dict(zip(columnas, fila)) for fila in cursor.fetchall()]
	finally:
		conexion.close()

	for inversion in inversiones:
		inversion["monto"] = float(inversion["monto"])
		inversion["creado_en"] = inversion["creado_en"].isoformat()

	return jsonify(inversiones)


@app.route("/api/inversiones/<int:inversion_id>", methods=["PUT", "PATCH"])
@login_requerido
def actualizar_inversion(inversion_id):
	# Modifica el monto o el inversionista de una inversión registrada.
	if not DB_DISPONIBLE:
		return respuesta_base_no_disponible()

	datos = request.get_json(silent=True) or {}
	actualizaciones = {}

	if "inversionista" in datos and str(datos["inversionista"]).strip():
		actualizaciones["inversionista"] = str(datos["inversionista"]).strip()

	if "monto" in datos:
		try:
			monto = float(datos["monto"])
		except (TypeError, ValueError):
			return jsonify({"error": "Ingresa un monto válido."}), 400
		if monto <= 0:
			return jsonify({"error": "El monto debe ser mayor a cero."}), 400
		actualizaciones["monto"] = monto

	if not actualizaciones:
		return jsonify({"error": "No hay datos para actualizar."}), 400

	set_sql = ", ".join(f"{clave} = %s" for clave in actualizaciones)
	valores = list(actualizaciones.values()) + [inversion_id, session.get("usuario_id")]

	conexion = conectar()
	try:
		cursor = conexion.cursor()
		cursor.execute(
			f"UPDATE inversiones SET {set_sql} WHERE id = %s AND creado_por = %s RETURNING id",
			valores,
		)
		fila = cursor.fetchone()
		if not fila:
			return jsonify({"error": "La inversión no existe."}), 404
		conexion.commit()
	except Exception as error:
		conexion.rollback()
		return jsonify({"error": str(error)}), 500
	finally:
		conexion.close()

	return jsonify({"success": True})


@app.delete("/api/inversiones/<int:inversion_id>")
@login_requerido
def eliminar_inversion(inversion_id):
	if not DB_DISPONIBLE:
		return respuesta_base_no_disponible()

	conexion = conectar()
	try:
		cursor = conexion.cursor()
		cursor.execute(
			"DELETE FROM inversiones WHERE id = %s AND creado_por = %s RETURNING monto",
			(inversion_id, session.get("usuario_id")),
		)
		fila = cursor.fetchone()
		if not fila:
			return jsonify({"error": "La inversión no existe."}), 404
		conexion.commit()
	except Exception as error:
		conexion.rollback()
		return jsonify({"error": str(error)}), 500
	finally:
		conexion.close()

	return jsonify({"success": True})


@app.post("/api/inversiones/retiros")
@login_requerido
def crear_retiro_inversion():
	# Retira capital del fondo. El monto no puede superar lo invertido.
	if not DB_DISPONIBLE:
		return respuesta_base_no_disponible()

	datos = request.get_json(silent=True) or {}
	try:
		monto = float(datos.get("monto") or 0)
	except (TypeError, ValueError):
		return jsonify({"error": "Ingresa un monto válido."}), 400
	inversionista = (datos.get("inversionista") or "Inversionista").strip() or "Inversionista"

	if monto <= 0:
		return jsonify({"error": "Ingresa un monto de retiro válido."}), 400

	usuario_id = session.get("usuario_id")
	conexion = conectar()
	try:
		cursor = conexion.cursor()
		cursor.execute("SELECT COALESCE(SUM(monto), 0) FROM inversiones WHERE creado_por = %s", (usuario_id,))
		total_invertido = float(cursor.fetchone()[0])
		cursor.execute("SELECT COALESCE(SUM(monto), 0) FROM retiros_inversiones WHERE creado_por = %s", (usuario_id,))
		total_retirado = float(cursor.fetchone()[0])
		disponible = total_invertido - total_retirado

		if monto > disponible:
			return jsonify({"error": f"El retiro supera el capital invertido disponible ({disponible:.2f})."}), 400

		cursor.execute(
			"INSERT INTO retiros_inversiones (creado_por, inversionista, monto) VALUES (%s, %s, %s) RETURNING id",
			(usuario_id, inversionista, monto),
		)
		retiro_id = cursor.fetchone()[0]
		conexion.commit()
	except Exception as error:
		conexion.rollback()
		return jsonify({"error": str(error)}), 500
	finally:
		conexion.close()

	return jsonify({"success": True, "retiro_id": retiro_id}), 201


@app.get("/api/inversiones/retiros")
@login_requerido
def listar_retiros_inversion():
	if not DB_DISPONIBLE:
		return respuesta_base_no_disponible()

	conexion = conectar()
	try:
		cursor = conexion.cursor()
		cursor.execute(
			"SELECT id, inversionista, monto, creado_en FROM retiros_inversiones "
			"WHERE creado_por = %s ORDER BY creado_en DESC",
			(session.get("usuario_id"),),
		)
		columnas = ("id", "inversionista", "monto", "creado_en")
		retiros = [dict(zip(columnas, fila)) for fila in cursor.fetchall()]
	finally:
		conexion.close()

	for retiro in retiros:
		retiro["monto"] = float(retiro["monto"])
		retiro["creado_en"] = retiro["creado_en"].isoformat()

	return jsonify(retiros)


@app.post("/api/admin/retiro-ganancia")
@login_requerido
def retirar_ganancia_admin():
	"""El admin retira su ganancia acumulada (para_admin). Queda registrada
	como un retiro y el acumulado para_admin vuelve a cero."""
	if not DB_DISPONIBLE:
		return respuesta_base_no_disponible()

	usuario_id = session.get("usuario_id")
	conexion = conectar()
	try:
		cursor = conexion.cursor()
		cursor.execute(
			"SELECT COALESCE(SUM(d.admin), 0) FROM distribucion_pagos d "
			"JOIN pagos pg ON pg.id = d.pago_id "
			"JOIN prestamos p ON p.id = pg.prestamo_id "
			"WHERE p.creado_por = %s",
			(usuario_id,),
		)
		acumulado = float(cursor.fetchone()[0])

		cursor.execute(
			"SELECT COALESCE(SUM(monto), 0) FROM retiros_ganancias_admin WHERE creado_por = %s",
			(usuario_id,),
		)
		ya_retirado = float(cursor.fetchone()[0])

		disponible = acumulado - ya_retirado
		if disponible <= 0:
			return jsonify({"error": "No tienes ganancias disponibles para retirar."}), 400

		cursor.execute(
			"INSERT INTO retiros_ganancias_admin (creado_por, monto) VALUES (%s, %s) RETURNING id",
			(usuario_id, disponible),
		)
		retiro_id = cursor.fetchone()[0]
		conexion.commit()
	except Exception as error:
		conexion.rollback()
		return jsonify({"error": str(error)}), 500
	finally:
		conexion.close()

	return jsonify({"success": True, "retiro_id": retiro_id, "monto_retirado": disponible}), 201


@app.get("/api/admin/retiros-ganancia")
@login_requerido
def listar_retiros_ganancia():
	if not DB_DISPONIBLE:
		return respuesta_base_no_disponible()

	conexion = conectar()
	try:
		cursor = conexion.cursor()
		cursor.execute(
			"SELECT id, monto, creado_en FROM retiros_ganancias_admin "
			"WHERE creado_por = %s ORDER BY creado_en DESC",
			(session.get("usuario_id"),),
		)
		retiros = [
			{"id": f[0], "monto": float(f[1]), "creado_en": f[2].isoformat()}
			for f in cursor.fetchall()
		]
	finally:
		conexion.close()

	return jsonify(retiros)


@app.post("/api/configuracion")
@login_requerido
def guardar_configuracion():
	if not DB_DISPONIBLE:
		return respuesta_base_no_disponible()

	datos = request.get_json(silent=True) or {}
	try:
		porcentajes = {
			"inversionista": float(datos["inversionista"]),
			"fondo": float(datos["fondo"]),
			"admin": float(datos["admin"]),
		}
	except (KeyError, TypeError, ValueError):
		return jsonify({"error": "Ingresa los tres porcentajes válidos."}), 400

	if any(valor < 0 or valor > 100 for valor in porcentajes.values()):
		return jsonify({"error": "Los porcentajes deben estar entre 0 y 100."}), 400
	if sum(porcentajes.values()) != 100:
		return jsonify({"error": "Los tres porcentajes deben sumar 100."}), 400

	conexion = conectar()
	try:
		cursor = conexion.cursor()
		for clave, valor in porcentajes.items():
			cursor.execute(
				"""
				INSERT INTO configuracion (clave, valor) VALUES (%s, %s)
				ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor
				""",
				(clave, valor),
			)
		conexion.commit()
	finally:
		conexion.close()

	return jsonify({"success": True, "porcentajes": porcentajes})


@app.get("/")
def inicio():
	return send_from_directory(".", "index.html")


@app.get("/login")
def login():
	if session.get("usuario_id"):
		return redirect(url_for("admin"))
	return render_template("login.html")


@app.get("/registro-admin")
def registro_admin_pagina():
	return render_template("registro_admin.html")


@app.get("/registro")
def registro():
	return render_template("registro.html", token="")

@app.get("/registro/<token>")
def registro_con_token(token):
	return render_template("registro.html", token=token)


@app.get("/admin")
@login_requerido
def admin():
	return render_template("admin.html")


@app.get("/cliente")
def cliente():
	cliente_id = request.args.get("id", "001").replace("#", "")
	datos = None

	if DB_DISPONIBLE and cliente_id.isdigit():
		conexion = conectar()
		try:
			cursor = conexion.cursor()
			cursor.execute(
				"""
				SELECT id, nombre, direccion, telefono, banco, cuenta, correo,
				       foto_frente, foto_reverso, estado
				FROM clientes WHERE id = %s AND creado_por = %s
				""",
				(int(cliente_id), session.get("usuario_id")),
				)
			fila = cursor.fetchone()
			if fila:
				datos = {
					"nombre": fila[1], "direccion": fila[2], "telefono": fila[3],
					"banco": fila[4], "cuenta": fila[5], "correo": fila[6], "estado": fila[8],
					"foto_frente_url": f"/api/clientes/{fila[0]}/foto/frente",
					"foto_reverso_url": f"/api/clientes/{fila[0]}/foto/reverso",
				}
		finally:
			conexion.close()

	if datos is None:
		datos = {
			"nombre": request.args.get("nombre", "Cliente nuevo"),
			"telefono": request.args.get("telefono", "Sin teléfono"),
			"banco": request.args.get("banco", "Sin banco"),
			"direccion": "Pendiente de completar",
			"cuenta": "Pendiente de completar",
			"estado": "PENDIENTE",
			"foto_frente_url": "",
			"foto_reverso_url": "",
		}

	return render_template(
		"cliente.html",
		cliente=datos,
		cliente_id=cliente_id,
	)


if __name__ == "__main__":
	# 0.0.0.0 permite abrir el panel y el formulario desde el celular
	# usando la IP de esta computadora en la red local.
	app.run(host="0.0.0.0", port=5050, debug=True)
