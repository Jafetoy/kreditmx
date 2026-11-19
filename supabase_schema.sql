-- ============================================================
-- Kreditmx: esquema para Supabase (PostgreSQL)
-- Pega este script completo en:
--   Supabase Dashboard > SQL Editor > New query > Run
-- ============================================================

-- ------------------------------------------------------------
-- ENLACES DE REGISTRO
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enlaces_registro (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    token VARCHAR(64) NOT NULL UNIQUE,
    usado BOOLEAN NOT NULL DEFAULT FALSE,
    creado_por BIGINT REFERENCES usuarios (id) ON DELETE SET NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- CLIENTES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    creado_por BIGINT REFERENCES usuarios (id) ON DELETE SET NULL,
    nombre VARCHAR(150) NOT NULL,
    nombres VARCHAR(100),
    apellidos VARCHAR(150),
    curp VARCHAR(18),
    fecha_nacimiento DATE,
    direccion VARCHAR(255) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    banco VARCHAR(80) NOT NULL,
    cuenta VARCHAR(32) NOT NULL,
    correo VARCHAR(150),
    ingreso_mensual NUMERIC(12, 2),
    ocupacion VARCHAR(150),
    foto_frente VARCHAR(255) NOT NULL,
    foto_reverso VARCHAR(255) NOT NULL,
    foto_frente_data BYTEA,
    foto_frente_tipo TEXT,
    foto_reverso_data BYTEA,
    foto_reverso_tipo TEXT,
    comprobante_domicilio_data BYTEA,
    comprobante_domicilio_tipo TEXT,
    autoriza_historial BOOLEAN NOT NULL DEFAULT FALSE,
    estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE clientes
    ADD COLUMN IF NOT EXISTS nombres VARCHAR(100),
    ADD COLUMN IF NOT EXISTS apellidos VARCHAR(150),
    ADD COLUMN IF NOT EXISTS curp VARCHAR(18),
    ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE,
    ADD COLUMN IF NOT EXISTS ingreso_mensual NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS ocupacion VARCHAR(150),
    ADD COLUMN IF NOT EXISTS foto_frente_data BYTEA,
    ADD COLUMN IF NOT EXISTS foto_frente_tipo TEXT,
    ADD COLUMN IF NOT EXISTS foto_reverso_data BYTEA,
    ADD COLUMN IF NOT EXISTS foto_reverso_tipo TEXT,
    ADD COLUMN IF NOT EXISTS comprobante_domicilio_data BYTEA,
    ADD COLUMN IF NOT EXISTS comprobante_domicilio_tipo TEXT,
    ADD COLUMN IF NOT EXISTS autoriza_historial BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_clientes_estado ON clientes (estado);
CREATE INDEX IF NOT EXISTS idx_clientes_telefono ON clientes (telefono);

-- ------------------------------------------------------------
-- PRESTAMOS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prestamos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cliente_id BIGINT NOT NULL REFERENCES clientes (id) ON DELETE CASCADE,
    creado_por BIGINT REFERENCES usuarios (id) ON DELETE SET NULL,
    monto NUMERIC(12, 2) NOT NULL,
    porcentaje NUMERIC(7, 2) NOT NULL DEFAULT 0,
    total NUMERIC(12, 2) NOT NULL,
    periodicidad VARCHAR(20) NOT NULL,
    numero_pagos INTEGER NOT NULL,
    fecha_inicio DATE NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prestamos_estado ON prestamos (estado);
CREATE INDEX IF NOT EXISTS idx_prestamos_cliente ON prestamos (cliente_id);

-- ------------------------------------------------------------
-- PAGOS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pagos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    prestamo_id BIGINT NOT NULL REFERENCES prestamos (id) ON DELETE CASCADE,
    numero_pago INTEGER NOT NULL,
    fecha_pago DATE NOT NULL,
    monto NUMERIC(12, 2) NOT NULL,
    saldo_anterior NUMERIC(12, 2) NOT NULL,
    nuevo_saldo NUMERIC(12, 2) NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (prestamo_id, numero_pago)
);

CREATE INDEX IF NOT EXISTS idx_pagos_fecha ON pagos (fecha_pago);

-- ------------------------------------------------------------
-- INVERSIONES (fondo de inversión)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inversiones (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    creado_por BIGINT REFERENCES usuarios (id) ON DELETE SET NULL,
    inversionista VARCHAR(150) NOT NULL DEFAULT 'Inversionista',
    monto NUMERIC(12, 2) NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- RETIROS DE INVERSIONES (capital retirado del fondo)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS retiros_inversiones (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    creado_por BIGINT REFERENCES usuarios (id) ON DELETE SET NULL,
    inversionista VARCHAR(150) NOT NULL DEFAULT 'Inversionista',
    monto NUMERIC(12, 2) NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- CONFIGURACION (porcentajes de reparto)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS configuracion (
    clave VARCHAR(50) PRIMARY KEY,
    valor NUMERIC(7, 2) NOT NULL
);

-- ------------------------------------------------------------
-- DISTRIBUCION DE PAGOS (reparte cada pago entre
-- inversionista, fondo y admin)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS distribucion_pagos (
    pago_id BIGINT PRIMARY KEY REFERENCES pagos (id) ON DELETE CASCADE,
    inversionista NUMERIC(12, 2) NOT NULL,
    fondo NUMERIC(12, 2) NOT NULL,
    admin NUMERIC(12, 2) NOT NULL
);

-- ------------------------------------------------------------
-- USUARIOS (acceso al panel de administrador)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre_completo VARCHAR(150) NOT NULL,
    usuario VARCHAR(50) NOT NULL UNIQUE,
    correo VARCHAR(150) NOT NULL UNIQUE,
    contrasena_hash VARCHAR(255) NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Columnas de aislamiento por usuario (para bases ya creadas)
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS creado_por BIGINT REFERENCES usuarios (id) ON DELETE SET NULL;
ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS creado_por BIGINT REFERENCES usuarios (id) ON DELETE SET NULL;
ALTER TABLE inversiones ADD COLUMN IF NOT EXISTS creado_por BIGINT REFERENCES usuarios (id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- Datos iniciales (porcentajes por defecto: 60 / 20 / 20)
-- ------------------------------------------------------------
INSERT INTO configuracion (clave, valor) VALUES
    ('inversionista', 60),
    ('fondo', 20),
    ('admin', 20)
ON CONFLICT (clave) DO NOTHING;

-- ------------------------------------------------------------
-- Verificación rápida
-- ------------------------------------------------------------
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
