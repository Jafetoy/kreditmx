import os
import secrets
import uuid
from datetime import date
import math

from flask import Flask, jsonify, render_template, request, send_from_directory
from werkzeug.utils import secure_filename

from database import conectar, inicializar_base


app = Flask(__name__)
app.config["UPLOAD_FOLDER"] = os.path.join(app.root_path, "uploads")
os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

try:
	inicializar_base()
	DB_DISPONIBLE = True
except Exception as error:
	print(f"MariaDB no disponible: {error}")
	DB_DISPONIBLE = False

CLIENTES = {
	"001": {
		"nombre": "Juan Pérez",
		"telefono": "5551234567",
		"banco": "BBVA",
		"direccion": "Av. Ejemplo #123, Ciudad de México",
		"cuenta": "1234567890123456",
		"estado": "PENDIENTE",
	},
	"002": {
		"nombre": "María López",
		"telefono": "5559876543",
		"banco": "Santander",
		"direccion": "Calle Reforma #45, Ciudad de México",
		"cuenta": "9876543210987654",
		"estado": "EN_REVISION",
	},
	"003": {
		"nombre": "Carlos García",
		"telefono": "5552223333",
		"banco": "Banorte",
		"direccion": "Av. Juárez #78, Ciudad de México",
		"cuenta": "4567890123456789",
		"estado": "APROBADO",
	},
}


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
	return jsonify({"error": "MariaDB no está disponible."}), 503


@app.post("/api/enlaces")
def crear_enlace():
	if not DB_DISPONIBLE:
		return respuesta_base_no_disponible()

	token = secrets.token_urlsafe(24)
	conexion = conectar()

	try:
		cursor = conexion.cursor()
		cursor.execute(
			"INSERT INTO enlaces_registro (token) VALUES (?)",
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
			"SELECT usado FROM enlaces_registro WHERE token = ?",
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
			(nombre, direccion, telefono, banco, cuenta, foto_frente, foto_reverso)
			VALUES (?, ?, ?, ?, ?, ?, ?)
			""",
			(
				campos["nombre"], campos["direccion"], campos["telefono"],
				campos["banco"], campos["cuenta"], archivos[0], archivos[1],
			),
		)
		cursor.execute(
			"UPDATE enlaces_registro SET usado = 1 WHERE token = ?",
			(token,),
		)
		conexion.commit()
		cursor.execute("SELECT LAST_INSERT_ID()")
		nuevo_id = cursor.fetchone()[0]
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
def resumen_admin():
	if not DB_DISPONIBLE:
		return respuesta_base_no_disponible()

	conexion = conectar()
	try:
		cursor = conexion.cursor()
		cursor.execute("SELECT COUNT(*) FROM clientes")
		total_clientes = cursor.fetchone()[0]
		cursor.execute("SELECT COUNT(*) FROM clientes WHERE estado = 'PENDIENTE'")
		pendientes = cursor.fetchone()[0]
		cursor.execute("SELECT COUNT(*) FROM clientes WHERE estado = 'EN_REVISION'")
		en_revision = cursor.fetchone()[0]
		cursor.execute("SELECT COUNT(*) FROM clientes WHERE estado = 'APROBADO'")
		aprobados = cursor.fetchone()[0]
		cursor.execute("SELECT COUNT(DISTINCT cliente_id) FROM prestamos WHERE estado = 'ACTIVO'")
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
def listar_clientes():
	if not DB_DISPONIBLE:
		return respuesta_base_no_disponible()

	conexion = conectar()
	try:
		cursor = conexion.cursor()
		cursor.execute(
			"SELECT id, nombre, direccion, telefono, banco, cuenta, "
			"foto_frente, foto_reverso, estado, creado_en "
			"FROM clientes ORDER BY creado_en DESC"
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
			(cliente_id, monto, porcentaje, total, periodicidad, numero_pagos, fecha_inicio)
			VALUES (?, ?, ?, ?, ?, ?, ?)
			""",
			(
				int(datos["cliente_id"]), monto, porcentaje, total,
				datos["periodicidad"], numero_pagos, datos["fecha_inicio"],
			),
		)
		conexion.commit()
		prestamo_id = cursor.lastrowid
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
			WHERE p.estado = 'ACTIVO'
			GROUP BY p.id
			ORDER BY p.creado_en DESC
			"""
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
			"SELECT total FROM prestamos WHERE id = ? AND estado = 'ACTIVO'",
			(int(datos["prestamo_id"]),),
		)
		prestamo = cursor.fetchone()
		if not prestamo:
			return jsonify({"error": "El préstamo activo no existe."}), 404

		cursor.execute(
			"SELECT COALESCE(SUM(monto), 0) FROM pagos WHERE prestamo_id = ?",
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
			VALUES (?, ?, ?, ?, ?, ?)
			""",
			(
				int(datos["prestamo_id"]), int(datos["numero_pago"]),
				datos["fecha_pago"], monto, saldo_anterior, nuevo_saldo,
			),
		)
		if nuevo_saldo == 0:
			cursor.execute(
				"UPDATE prestamos SET estado = 'LIQUIDADO' WHERE id = ?",
				(int(datos["prestamo_id"]),),
			)
		conexion.commit()
		pago_id = cursor.lastrowid
	finally:
		conexion.close()

	return jsonify({"success": True, "pago_id": pago_id, "saldo": nuevo_saldo}), 201


@app.get("/")
def inicio():
	return send_from_directory(".", "index.html")


@app.get("/login")
def login():
	return render_template("login.html")


@app.get("/registro")
def registro():
	return render_template("registro.html", token="")

@app.get("/registro/<token>")
def registro_con_token(token):
	return render_template("registro.html", token=token)


@app.get("/admin")
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
				FROM clientes WHERE id = ?
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
		datos = CLIENTES.get(cliente_id)

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
