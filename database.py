import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv


load_dotenv()


# Con Supabase se puede usar DATABASE_URL (del dashboard: Settings > Database)
# o las variables individuales.
DB_URL = os.getenv("SUPABASE_DB_URL") or os.getenv("DATABASE_URL")

DB_CONFIG = {
	"host": os.getenv("SUPABASE_HOST"),
	"port": int(os.getenv("SUPABASE_PORT", "5432")),
	"user": os.getenv("SUPABASE_USER", "postgres"),
	"password": os.getenv("SUPABASE_PASSWORD", "bGClM0bfdN2PZtkW"),
	"dbname": os.getenv("SUPABASE_DB", "postgres"),
}


def conectar(incluir_base=True):
	if DB_URL:
		return psycopg2.connect(DB_URL)

	return psycopg2.connect(**DB_CONFIG)


def inicializar_base():
	"""Con Supabase el esquema se aplica ejecutando supabase_schema.sql
	en el SQL Editor del dashboard. Solo se verifica la conexión."""
	conexion = conectar()
	conexion.close()
