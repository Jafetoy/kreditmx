import importlib
import unittest
from unittest.mock import patch

import database


class LiquidationCursor:
    def __init__(self):
        self.calls = []
        self.query = ""

    def execute(self, query, params=None):
        self.query = str(query)
        self.calls.append((self.query, params))

    def fetchone(self):
        if "SELECT total FROM prestamos" in self.query:
            return (15000.00,)
        if "SELECT COALESCE(SUM(monto), 0) FROM pagos" in self.query:
            return (5000.00,)
        if "RETURNING id" in self.query:
            return (88,)
        return None

    def fetchall(self):
        return []


class LiquidationConnection:
    def __init__(self):
        self.cursor_instance = LiquidationCursor()
        self.commits = 0

    def cursor(self):
        return self.cursor_instance

    def commit(self):
        self.commits += 1

    def close(self):
        pass


def load_app_module():
    startup_connection = LiquidationConnection()
    with (
        patch.object(database, "inicializar_base"),
        patch.object(database, "conectar", return_value=startup_connection),
    ):
        return importlib.import_module("app")


app_module = load_app_module()


class PaymentLiquidationTest(unittest.TestCase):
    def setUp(self):
        app_module.app.config.update(TESTING=True)
        app_module.DB_DISPONIBLE = True
        self.client = app_module.app.test_client()
        self.connection = LiquidationConnection()
        with self.client.session_transaction() as session:
            session["usuario_id"] = 17

    def test_full_balance_payment_liquidates_loan_and_keeps_payment_distribution(self):
        with patch.object(app_module, "conectar", return_value=self.connection):
            response = self.client.post(
                "/api/pagos",
                json={
                    "prestamo_id": 42,
                    "numero_pago": 3,
                    "fecha_pago": "2026-11-21",
                    "monto": 10000.00,
                },
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()["saldo"], 0)
        self.assertEqual(
            response.get_json()["reparto"],
            {"inversionista": 6000.0, "fondo": 2000.0, "admin": 2000.0},
        )
        queries = [query for query, _ in self.connection.cursor_instance.calls]
        self.assertTrue(any("UPDATE prestamos SET estado = 'LIQUIDADO'" in query for query in queries))
        self.assertTrue(any("INSERT INTO pagos" in query for query in queries))
        self.assertTrue(any("INSERT INTO distribucion_pagos" in query for query in queries))
        self.assertEqual(self.connection.commits, 2)


if __name__ == "__main__":
    unittest.main()
