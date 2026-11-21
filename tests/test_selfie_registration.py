import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


class SelfieRegistrationFormTest(unittest.TestCase):
    def setUp(self):
        self.registro_html = (ROOT / "templates" / "registro.html").read_text(
            encoding="utf-8"
        )
        self.registro_js = (ROOT / "js" / "registro.js").read_text(encoding="utf-8")

    def test_registration_asks_for_a_selfie_using_the_device_camera(self):
        html = self.registro_html

        self.assertIn("<strong>Selfie</strong>", html)
        self.assertNotIn("<strong>Comprobante de domicilio</strong>", html)

        input_line = next(
            line for line in html.splitlines() if 'id="comprobanteDomicilio"' in line
        )
        self.assertIn('name="comprobante_domicilio"', input_line)
        self.assertIn('capture="user"', input_line)
        self.assertIn('accept="image/jpeg,image/png,image/webp"', input_line)
        self.assertNotIn("pdf", input_line.lower())

    def test_registration_copy_no_longer_prompts_for_address_proof(self):
        self.assertNotIn("PDF", self.registro_html)
        self.assertNotIn("Como aparece en tu comprobante", self.registro_html)

    def test_preview_only_accepts_images(self):
        self.assertIn("Selecciona una imagen válida.", self.registro_js)
        self.assertNotIn("Selecciona una imagen o PDF válido.", self.registro_js)

    def test_no_visible_ui_still_says_proof_of_address(self):
        ui_files = sorted((ROOT / "templates").glob("*.html")) + sorted(
            (ROOT / "js").glob("*.js")
        )
        for path in ui_files:
            with self.subTest(path=path.relative_to(ROOT)):
                text = path.read_text(encoding="utf-8").lower()
                self.assertNotIn("comprobante de domicilio", text)
                self.assertNotIn("comprobante domicilio", text)


if __name__ == "__main__":
    unittest.main()
