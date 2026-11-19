import importlib
import io
import unittest
from unittest.mock import Mock, patch

import database


class RecordingCursor:
    def __init__(self):
        self.calls = []
        self._last_query = ""

    def execute(self, query, params=None):
        self._last_query = str(query)
        self.calls.append((self._last_query, params))

    def fetchone(self):
        if "SELECT usado, creado_por" in self._last_query:
            return (False, 7)
        if "RETURNING id" in self._last_query:
            return (42,)
        return (0,)


class RecordingConnection:
    def __init__(self):
        self.cursor_instance = RecordingCursor()
        self.committed = False
        self.rolled_back = False

    def cursor(self):
        return self.cursor_instance

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True

    def close(self):
        pass


def load_app_module():
    startup_connection = RecordingConnection()
    with (
        patch.object(database, "inicializar_base"),
        patch.object(database, "conectar", return_value=startup_connection),
    ):
        return importlib.import_module("app")


app_module = load_app_module()


class RegistrationFieldsTest(unittest.TestCase):
    def setUp(self):
        app_module.app.config.update(TESTING=True)
        app_module.DB_DISPONIBLE = True
        self.client = app_module.app.test_client()

    @staticmethod
    def valid_payload():
        return {
            "token": "valid-token",
            "nombre": "María López",
            "nombres": "María",
            "apellidos": "López",
            "curp": "LOPM900101MDFPRR01",
            "fecha_nacimiento": "1990-01-01",
            "direccion": "Calle Uno 123",
            "telefono": "5512345678",
            "banco": "BBVA",
            "cuenta": "123456789012345678",
            "correo": "maria@example.com",
            "ingreso_mensual": "18500.50",
            "ocupacion": "Comerciante",
            "autoriza_historial": "true",
            "foto_frente": (io.BytesIO(b"front"), "front.jpg", "image/jpeg"),
            "foto_reverso": (io.BytesIO(b"back"), "back.png", "image/png"),
            "comprobante_domicilio": (io.BytesIO(b"proof"), "proof.pdf", "application/pdf"),
        }

    def test_registration_persists_every_figma_field_and_document(self):
        connection = RecordingConnection()

        with patch.object(app_module, "conectar", return_value=connection):
            response = self.client.post(
                "/api/registro",
                data=self.valid_payload(),
                content_type="multipart/form-data",
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["cliente_id"], 42)
        insert_call = next(call for call in connection.cursor_instance.calls if "INSERT INTO clientes" in call[0])
        query, params = insert_call
        for column in (
            "nombres",
            "apellidos",
            "curp",
            "fecha_nacimiento",
            "ingreso_mensual",
            "ocupacion",
            "comprobante_domicilio_data",
            "autoriza_historial",
        ):
            self.assertIn(column, query)
        self.assertEqual(query.count("%s"), len(params))
        self.assertEqual(params[2:6], ("María", "López", "LOPM900101MDFPRR01", "1990-01-01"))
        self.assertEqual(params[11], 18500.50)
        self.assertEqual(params[12], "Comerciante")
        self.assertIs(params[-1], True)
        self.assertTrue(connection.committed)

    def test_registration_rejects_a_missing_proof_of_address(self):
        payload = self.valid_payload()
        payload.pop("comprobante_domicilio")

        response = self.client.post(
            "/api/registro",
            data=payload,
            content_type="multipart/form-data",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("documentos requeridos", response.get_json()["error"])


if __name__ == "__main__":
    unittest.main()
