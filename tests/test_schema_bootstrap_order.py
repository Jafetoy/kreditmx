import pathlib
import re
import unittest


class SchemaBootstrapOrderTest(unittest.TestCase):
    def test_railway_start_command_uses_gunicorn_port_detection(self):
        procfile_path = pathlib.Path(__file__).resolve().parents[1] / "Procfile"
        procfile = procfile_path.read_text(encoding="utf-8").strip()

        self.assertEqual(procfile, "web: gunicorn --workers 2 app:app")

    def test_users_table_exists_before_foreign_keys_reference_it(self):
        schema_path = pathlib.Path(__file__).resolve().parents[1] / "supabase_schema.sql"
        schema = schema_path.read_text(encoding="utf-8")
        users_table = re.search(
            r"CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+usuarios\s*\(",
            schema,
            re.IGNORECASE,
        )
        user_references = list(
            re.finditer(r"REFERENCES\s+usuarios\s*\(", schema, re.IGNORECASE)
        )

        self.assertIsNotNone(users_table, "schema must create usuarios")
        self.assertTrue(user_references, "schema must retain user ownership foreign keys")
        self.assertLess(
            users_table.start(),
            user_references[0].start(),
            "usuarios must be created before any table references it",
        )


if __name__ == "__main__":
    unittest.main()
