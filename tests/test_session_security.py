import importlib
import pathlib
import unittest
from unittest.mock import patch

import database


class DummyCursor:
    def execute(self, *args, **kwargs):
        return None

    def fetchone(self):
        return (7,)

    def fetchall(self):
        return []


class DummyConnection:
    def cursor(self):
        return DummyCursor()

    def commit(self):
        return None

    def rollback(self):
        return None

    def close(self):
        return None


def load_app_module():
    startup_connection = DummyConnection()
    with (
        patch.object(database, "inicializar_base"),
        patch.object(database, "conectar", return_value=startup_connection),
    ):
        return importlib.import_module("app")


app_module = load_app_module()


class SessionSecurityTest(unittest.TestCase):
    def setUp(self):
        app_module.app.config.update(TESTING=True)
        app_module.DB_DISPONIBLE = False
        self.client = app_module.app.test_client()

    def test_admin_page_is_not_stored_in_browser_cache(self):
        with self.client.session_transaction() as session:
            session["usuario_id"] = 7

        response = self.client.get("/admin")

        self.assertEqual(response.status_code, 200)
        self.assertIn("no-store", response.headers.get("Cache-Control", ""))

    def test_client_page_requires_authentication(self):
        response = self.client.get("/cliente?id=7")

        self.assertEqual(response.status_code, 302)
        self.assertIn("/login", response.headers.get("Location", ""))

    def test_session_cookie_is_hardened(self):
        self.assertTrue(app_module.app.config.get("SESSION_COOKIE_HTTPONLY"))
        self.assertEqual(app_module.app.config.get("SESSION_COOKIE_SAMESITE"), "Lax")

    def test_logout_clears_session_and_is_not_stored(self):
        with self.client.session_transaction() as session:
            session["usuario_id"] = 7

        response = self.client.post("/api/logout")

        self.assertEqual(response.status_code, 200)
        self.assertIn("no-store", response.headers.get("Cache-Control", ""))
        with self.client.session_transaction() as session:
            self.assertNotIn("usuario_id", session)


class SessionSecurityProbeTest(unittest.TestCase):
    def setUp(self):
        app_module.app.config.update(TESTING=True)
        app_module.DB_DISPONIBLE = False
        self.client = app_module.app.test_client()

    def test_cache_headers_exact_on_redirect_json_and_404(self):
        cc = "no-store, no-cache, must-revalidate, max-age=0"
        for response in (
            self.client.get("/admin"),
            self.client.get("/api/sesion"),
            self.client.get("/missing-route-probe"),
        ):
            self.assertEqual(response.headers.get("Cache-Control"), cc)
            self.assertEqual(response.headers.get("Pragma"), "no-cache")
            self.assertEqual(response.headers.get("Expires"), "0")

    def test_api_sesion_exact_payloads(self):
        response = self.client.get("/api/sesion")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json(), {"error": "No autorizado. Inicia sesión."})
        with self.client.session_transaction() as session:
            session["usuario_id"] = 7
        response = self.client.get("/api/sesion")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"autenticado": True})

    def test_logout_cookie_flags_and_post_logout_guard(self):
        with self.client.session_transaction() as session:
            session["usuario_id"] = 7
        cookie = self.client.post("/api/logout").headers.get("Set-Cookie", "")
        self.assertIn("HttpOnly", cookie)
        self.assertIn("SameSite=Lax", cookie)
        self.assertEqual(self.client.get("/admin").status_code, 302)
        self.assertEqual(self.client.get("/api/sesion").status_code, 401)

    def test_cliente_guard_covers_missing_and_malformed_id(self):
        self.assertEqual(self.client.get("/cliente").status_code, 302)
        self.assertEqual(self.client.get("/cliente?id=%3Cscript%3E").status_code, 302)

    def test_s6_endpoints_still_registered(self):
        rules = {rule.rule for rule in app_module.app.url_map.iter_rules()}
        for path in (
            "/api/fondo", "/api/inversiones", "/api/pagos", "/api/prestamos",
            "/api/registro", "/api/logout", "/cliente", "/api/sesion",
            "/registro-admin", "/api/registro-admin",
        ):
            self.assertIn(path, rules)

    def test_guard_and_replace_wiring(self):
        root = pathlib.Path(__file__).resolve().parents[1]
        guard = (root / "js" / "session-guard.js").read_text(encoding="utf-8")
        for token in ("visibilitychange", "pageshow", 'window.location.replace("/login")'):
            self.assertIn(token, guard)
        self.assertIn(
            'window.location.replace("/")',
            (root / "js" / "admin.js").read_text(encoding="utf-8"),
        )
        for template in ("admin.html", "cliente.html"):
            html = (root / "templates" / template).read_text(encoding="utf-8")
            self.assertIn("/js/session-guard.js", html)


if __name__ == "__main__":
    unittest.main()
