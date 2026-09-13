import os
import secrets
import uuid
from datetime import date
import math

from flask import Flask, jsonify, render_template, redirect, request, send_from_directory, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

from database import conectar, inicializar_base


app = Flask(__name__)
app.config["UPLOAD_FOLDER"] = os.path.join(app.root_path, "uploads")
app.secret_key = os.getenv("SECRET_KEY") or secrets.token_hex(32)
os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

try:
	inicializar_base()
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


@app.post("/api/enlaces")
def crear_enlace():
	if not DB_DISPONIBLE:
		return respuesta_base_no_disponible()

	token = secrets.token_urlsafe(24)
	conexion = conectar()

	try:
		cursor = conexion.cursor()
		cursor.execute(
			"INSERT INTO enlaces_registro (token) VALUES (%s)",
			(token,),
		)
		conexion.commit()
	finally:
		conexion.close()

	return jsonify({
		"success": True,
		"token": token,
		"url": f"{request.host_url.rstrip('/')}/registro/{token}",
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
	}
	foto_frente = request.files.get("fotoFrente") or request.files.get("foto_frente")
	foto_reverso = request.files.get("fotoReverso") or request.files.get("foto_reverso")

	if not token or any(not valor for valor in campos.values()) or not foto_frente or not foto_reverso:
		return jsonify({"error": "Completa todos los datos y documentos requeridos."}), 400

	conexion = conectar()

	try:
		cursor = conexion.cursor()
		cursor.execute(
			"SELECT usado FROM enlaces_registro WHERE token = %s",
			(token,),
		)
		registro = cursor.fetchone()

		if not registro:
			return jsonify({"error": "El enlace de registro no es válido."}), 404
		if registro[0]:
			return jsonify({"error": "Este enlace de registro ya fue utilizado."}), 409

		archivos = []
		for archivo in (foto_frente, foto_reverso):
			nombre = f"{uuid.uuid4().hex}_{secure_filename(archivo.filename)}"
			archivo.save(os.path.join(app.config["UPLOAD_FOLDER"], nombre))
			archivos.append(nombre)

		cursor.execute(
			"""
			INSERT INTO clientes
			(creado_por, nombre, direccion, telefono, banco, cuenta, foto_frente, foto_reverso)
			VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
			RETURNING id
			""",
			(
				session.get("usuario_id"), campos["nombre"], campos["direccion"], campos["telefono"],
				campos["banco"], campos["cuenta"], archivos[0], archivos[1],
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
		cursor.execute(
			"SELECT COUNT(*) FROM clientes WHERE creado_por = %s", (usuario_id,)
		)
		total_clientes = cursor.fetchone()[0]
		cursor.execute(
			"SELECT COUNT(*) FROM clientes WHERE estado = 'PENDIENTE' AND creado_por = %s",
			(usuario_id,),
		)
		pendientes = cursor.fetchone()[0]
		cursor.execute(
			"SELECT COUNT(*) FROM clientes WHERE estado = 'EN_REVISION' AND creado_por = %s",
			(usuario_id,),
		)
		en_revision = cursor.fetchone()[0]
		cursor.execute(
			"SELECT COUNT(*) FROM clientes WHERE estado = 'APROBADO' AND creado_por = %s",
			(usuario_id,),
		)
		aprobados = cursor.fetchone()[0]
		cursor.execute(
			"SELECT COUNT(DISTINCT cliente_id) FROM prestamos WHERE estado = 'ACTIVO' AND creado_por = %s",
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
		usuario_id = session.get("usuario_id")
		cursor.execute(
			"SELECT id, nombre, direccion, telefono, banco, cuenta, "
			"foto_frente, foto_reverso, estado, creado_en "
			"FROM clientes WHERE creado_por = %s ORDER BY creado_en DESC",
			(usuario_id,),
		)
		columnas = (
			"id", "nombre", "direccion", "telefono", "banco", "cuenta",
			"foto_frente", "foto_reverso", "estado", "creado_en",
		)
		clientes = [dict(zip(columnas, fila)) for fila in cursor.fetchall()]
	finally:
		conexion.close()

	for cliente in clientes:
		cliente["creado_en"] = cliente["creado_en"].isoformat()
		cliente["foto_frente_url"] = f"/uploads/{cliente['foto_frente']}"
		cliente["foto_reverso_url"] = f"/uploads/{cliente['foto_reverso']}"

	return jsonify(clientes)


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
			       COALESCE(SUM(pg.monto), 0) AS pagado
			FROM prestamos p
			JOIN clientes c ON c.id = p.cliente_id
			LEFT JOIN pagos pg ON pg.prestamo_id = p.id
			WHERE p.estado = 'ACTIVO' AND p.creado_por = %s
			GROUP BY p.id
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
			"SELECT total FROM prestamos WHERE id = %s AND estado = 'ACTIVO'",
			(int(datos["prestamo_id"]),),
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
		total_invertido = float(cursor.fetchone()[0])

		cursor.execute("SELECT COALESCE(SUM(monto), 0) FROM prestamos WHERE creado_por = %s", (usuario_id,))
		prestado = float(cursor.fetchone()[0])

		cursor.execute(
			"SELECT COALESCE(SUM(d.inversionista), 0), COALESCE(SUM(d.fondo), 0), "
			"COALESCE(SUM(d.admin), 0) FROM distribucion_pagos d "
			"JOIN pagos pg ON pg.id = d.pago_id "
			"JOIN prestamos p ON p.id = pg.prestamo_id "
			"WHERE p.creado_por = %s",
			(usuario_id,),
		)
		fila = cursor.fetchone()
		para_inversionista = float(fila[0])
		para_fondo = float(fila[1])
		para_admin = float(fila[2])

		porcentajes = obtener_porcentajes(cursor)
	finally:
		conexion.close()

	# El fondo disponible crece con la parte del pago asignada al fondo.
	fondo_disponible = total_invertido - prestado + para_fondo

	return jsonify({
		"total_invertido": total_invertido,
		"prestado": prestado,
		"fondo_disponible": fondo_disponible,
		"para_inversionista": para_inversionista,
		"para_fondo": para_fondo,
		"para_admin": para_admin,
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
				SELECT id, nombre, direccion, telefono, banco, cuenta,
				       foto_frente, foto_reverso, estado
				FROM clientes WHERE id = %s
				""",
				(int(cliente_id),),
			)
			fila = cursor.fetchone()
			if fila:
				datos = {
					"nombre": fila[1], "direccion": fila[2], "telefono": fila[3],
					"banco": fila[4], "cuenta": fila[5], "estado": fila[8],
					"foto_frente_url": f"/uploads/{fila[6]}",
					"foto_reverso_url": f"/uploads/{fila[7]}",
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
	app.run(host="127.0.0.1", port=5050, debug=True)
