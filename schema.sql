-- Kreditmx: base de datos MariaDB
-- Ejecutar como root o un usuario con permisos CREATE/GRANT.

CREATE DATABASE IF NOT EXISTS kreditmx
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'kreditmx_app'@'localhost'
    IDENTIFIED BY 'Cambia_Esta_Password';

GRANT ALL PRIVILEGES ON kreditmx.*
    TO 'kreditmx_app'@'localhost';

FLUSH PRIVILEGES;

USE kreditmx;

CREATE TABLE IF NOT EXISTS enlaces_registro (
    token VARCHAR(64) PRIMARY KEY,
    usado TINYINT(1) NOT NULL DEFAULT 0,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

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
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_clientes_estado (estado),
    INDEX idx_clientes_telefono (telefono)
) ENGINE=InnoDB;

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
    INDEX idx_prestamos_estado (estado),
    INDEX idx_prestamos_cliente (cliente_id),
    CONSTRAINT fk_prestamo_cliente
        FOREIGN KEY (cliente_id) REFERENCES clientes(id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

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
    INDEX idx_pagos_fecha (fecha_pago),
    CONSTRAINT fk_pago_prestamo
        FOREIGN KEY (prestamo_id) REFERENCES prestamos(id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- Verificación rápida
SHOW TABLES;
DESCRIBE clientes;
DESCRIBE prestamos;
DESCRIBE pagos;
DESCRIBE enlaces_registro;
