import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


class AdminSolicitudesTest(unittest.TestCase):
    def setUp(self):
        self.html = (ROOT / "templates" / "admin.html").read_text(encoding="utf-8")
        self.js = (ROOT / "js" / "admin.js").read_text(encoding="utf-8")
        self.shell_css = (ROOT / "css" / "figma-admin-shell.css").read_text(encoding="utf-8")
        self.workflows_css = (ROOT / "css" / "figma-admin-workflows.css").read_text(encoding="utf-8")

    def test_notification_bell_and_badge_are_in_the_header(self):
        self.assertIn('class="kx-notificaciones"', self.html)
        self.assertIn('id="kxNotificacionesBoton"', self.html)
        self.assertIn('id="kxNotificacionesBadge"', self.html)
        self.assertIn("Notificaciones: ver solicitudes", self.html)
        self.assertIn("mostrarModulo('solicitudes')", self.html)
        self.assertIn(".kx-notificaciones b", self.shell_css)

    def test_sidebar_has_solicitudes_item(self):
        self.assertIn('data-label="Solicitudes"', self.html)
        self.assertIn('aria-label="Solicitudes"', self.html)
        self.assertIn("<strong>Solicitudes</strong>", self.html)
        self.assertIn("kxSolicitudesRailBadge", self.html)

    def test_solicitudes_panel_and_styles_exist(self):
        self.assertIn(
            '<section id="modulo-solicitudes" class="panel modulo-panel" data-modulo="solicitudes">',
            self.html,
        )
        for element_id in (
            "kxSolicitudesTotal",
            "kxSolicitudesPendientes",
            "kxSolicitudesRevision",
            "kxSolicitudesLista",
        ):
            self.assertIn(element_id, self.html)
        self.assertIn(".kx-solicitudes-lista", self.workflows_css)
        self.assertIn(".kx-solicitud-estado", self.workflows_css)

    def test_rendering_reuses_existing_payload_and_helpers(self):
        self.assertIn("function renderizarSolicitudes(resumen, clientes)", self.js)
        self.assertIn("renderizarSolicitudes(resumen, clientes);", self.js)
        self.assertIn(
            'cliente.estado === "PENDIENTE" || cliente.estado === "EN_REVISION"',
            self.js,
        )
        self.assertIn('href="/cliente?id=', self.js)
        self.assertIn("kxEscapar(kxIniciales(nombre))", self.js)
        self.assertIn("kxTiempoRelativo(cliente.creado_en)", self.js)
