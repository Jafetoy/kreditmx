import os

import mariadb
from dotenv import load_dotenv


load_dotenv()


DB_CONFIG = {
	"host": os.getenv("MARIADB_HOST", "172.25.228.151"),
	"port": int(os.getenv("MARIADB_PORT", "3306")),
	"user": os.getenv("MARIADB_USER", "jafet22"),
	"password": os.getenv("MARIADB_PASSWORD", "2204"),
	"database": os.getenv("MARIADB_DATABASE", "kreditmx"),
}


def conectar(incluir_base=True):
	configuracion = DB_CONFIG.copy()

	if not incluir_base:
		configuracion.pop("database", None)

	return mariadb.connect(**configuracion)


def inicializar_base():
	nombre_base = DB_CONFIG["database"]
	conexion_servidor = conectar(incluir_base=False)

	try:
		cursor = conexion_servidor.cursor()
		cursor.execute(
			f"CREATE DATABASE IF NOT EXISTS `{nombre_base}` "
			"CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
		)
		conexion_servidor.commit()
	finally:
		conexion_servidor.close()

	conexion = conectar()

	try:
		cursor = conexion.cursor()
		cursor.execute(
			"""
			CREATE TABLE IF NOT EXISTS enlaces_registro (
				token VARCHAR(64) PRIMARY KEY,
				usado TINYINT(1) NOT NULL DEFAULT 0,
				creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
			) ENGINE=InnoDB
			"""
		)
		cursor.execute(
			"""
			CREATE TABLE IF NOT EXISTS clientes (
				id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
				nombre VARCHAR(150) NOT NULL,
				direccion VARCHAR(255) NOT NULL,
				telefono VARCHAR(20) NOT NULL,
				banco VARCHAR(80) NOT NULL,
				cuenta VARCHAR(32) NOT NULL,
				foto_frente VARCHAR(255) NOT NULL,
				foto_reverso VARCHAR(255) NOT NULL,
				estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
				creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
			) ENGINE=InnoDB
			"""
		)
		cursor.execute(
			"""
			CREATE TABLE IF NOT EXISTS prestamos (
				id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
				cliente_id INT UNSIGNED NOT NULL,
				monto DECIMAL(12, 2) NOT NULL,
				porcentaje DECIMAL(7, 2) NOT NULL DEFAULT 0,
				total DECIMAL(12, 2) NOT NULL,
				periodicidad VARCHAR(20) NOT NULL,
				numero_pagos INT UNSIGNED NOT NULL,
				fecha_inicio DATE NOT NULL,
				estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
				creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
				CONSTRAINT fk_prestamo_cliente
					FOREIGN KEY (cliente_id) REFERENCES clientes(id)
					ON DELETE CASCADE
			) ENGINE=InnoDB
			"""
		)
		cursor.execute(
			"""
			CREATE TABLE IF NOT EXISTS pagos (
				id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
				prestamo_id INT UNSIGNED NOT NULL,
				numero_pago INT UNSIGNED NOT NULL,
				fecha_pago DATE NOT NULL,
				monto DECIMAL(12, 2) NOT NULL,
				saldo_anterior DECIMAL(12, 2) NOT NULL,
				nuevo_saldo DECIMAL(12, 2) NOT NULL,
				creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
				UNIQUE KEY uq_pago_prestamo (prestamo_id, numero_pago),
				CONSTRAINT fk_pago_prestamo
					FOREIGN KEY (prestamo_id) REFERENCES prestamos(id)
					ON DELETE CASCADE
			) ENGINE=InnoDB
			"""
		)
		conexion.commit()
	finally:
		conexion.close()
