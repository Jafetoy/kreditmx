import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


class LoginResponsiveTest(unittest.TestCase):
    def setUp(self):
        self.css = (ROOT / "css" / "figma-auth-client.css").read_text(encoding="utf-8")

    def test_login_card_clears_the_legacy_400px_cap(self):
        marker = ".kx-auth-page .login-card {"
        self.assertIn(marker, self.css)
        block = self.css.split(marker, 1)[1].split("}", 1)[0]
        self.assertIn("width: min(500px, 100%)", block)
        self.assertIn("max-width: 500px", block)
