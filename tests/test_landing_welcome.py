import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


class FigmaWelcomeLandingTest(unittest.TestCase):
    def setUp(self):
        self.html = (ROOT / "index.html").read_text(encoding="utf-8")
        self.theme = (ROOT / "css" / "figma-theme.css").read_text(encoding="utf-8")
        self.css = (ROOT / "css" / "figma-welcome.css").read_text(encoding="utf-8")

    def test_landing_uses_the_figma_welcome_composition(self):
        expected = [
            'class="kw-page"',
            "PLATAFORMA DE ADMINISTRACIÓN CREDITICIA",
            "KREDITMX / PORTAL CORPORATIVO",
            "Una visión clara.",
            "Mejores decisiones.",
            "Centraliza la gestión de tu cartera, supervisa el capital y da seguimiento a cada crédito desde un solo lugar.",
            "Entorno de trabajo exclusivo para personal autorizado.",
            "VISIÓN EJECUTIVA",
            "Resumen de capital",
            "Capital disponible",
            "$426,800",
            "PESOS MEXICANOS · MXN",
            "Disponibilidad del fondo",
            "25%",
            "Solicitudes por revisar",
            "Clientes activos",
            "Cartera activa · MXN",
            "Información de referencia para la operación diaria.",
            "Control de cartera",
            "Gestión de clientes",
            "Visibilidad del capital",
            "KREDITMX® / USO EXCLUSIVO DE ADMINISTRACIÓN",
            "ACCESO ADMINISTRATIVO",
            "GESTIÓN CON VISIÓN.",
        ]
        for text in expected:
            with self.subTest(text=text):
                self.assertIn(text, self.html)

    def test_landing_keeps_existing_destinations_and_drops_legacy_markup(self):
        self.assertIn('href="/login"', self.html)
        self.assertIn('href="/registro"', self.html)
        self.assertIn("Acceder al panel", self.html)
        self.assertIn("Consultar formulario del solicitante", self.html)
        self.assertNotIn("kx-home-page", self.html)
        self.assertNotIn("inicio-logo", self.html)
        self.assertNotIn("css/admin.css", self.html)
        self.assertNotIn("kw-session", self.html)
        self.assertNotIn("ARTURO LÓPEZ", self.html)
        self.assertNotIn(">AL<", self.html)

    def test_theme_imports_the_scoped_welcome_stylesheet(self):
        self.assertIn("/css/figma-welcome.css", self.theme)

    def test_welcome_stylesheet_preserves_figma_palette_and_breakpoints(self):
        self.assertIn("body {", self.css)
        self.assertIn("margin: 0;", self.css)
        for token in [
            ".kw-page",
            "#0f1b35",
            "#a9e925",
            "#b5f34b",
            "#426d16",
            "#f7f9f3",
            "@media (max-width: 900px)",
            "@media (max-width: 640px)",
            "prefers-reduced-motion",
        ]:
            with self.subTest(token=token):
                self.assertIn(token, self.css)
