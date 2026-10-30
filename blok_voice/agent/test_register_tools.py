"""Enregistrement des 9 outils BLOK sur l'agent (sans aucun appel réseau).

Lancez depuis la racine du dépôt :
    blok_voice/.venv/bin/python -m unittest discover -s blok_voice/agent -p "test_*.py"
"""
import importlib
import io
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch


def _module(env_extra=None):
    env = {
        "AETHEX_API_KEY": "cle-fictive-pour-test",
        "AGENT_ID": "agent-fictif",
        "VOICE_TOOL_SECRET": "secret-fictif-16-chars-minimum",
    }
    env.update(env_extra or {})
    with patch.dict("os.environ", env, clear=False):
        import os  # noqa: F401  (garantit os.environ patché avant import)
        import register_tools
        importlib.reload(register_tools)
    return register_tools


EXPECTED = {
    "catalog_search": ("/api/v1/relance/tools/catalog-search", ["query"]),
    "prepare_material_list": ("/api/v1/relance/tools/prepare-material-list", ["customerRef", "items"]),
    "confirm_rfq": (
        "/api/v1/relance/tools/confirm-rfq",
        ["organizationId", "items", "confirmationClient", "idempotenceKey"],
    ),
    "record_call_outcome": (
        "/api/v1/relance/tools/record-call-outcome",
        ["attemptId", "outcome", "summary"],
    ),
    "record_voice_opt_out": ("/api/v1/relance/tools/record-voice-opt-out", ["customerRef"]),
    "request_human_handoff": (
        "/api/v1/relance/tools/request-human-handoff",
        ["customerRef", "motive", "summary"],
    ),
    "record_recommendations": (
        "/api/v1/relance/tools/record-recommendations",
        ["sessionId", "items"],
    ),
    "confirm_selections": (
        "/api/v1/relance/tools/confirm-selections",
        ["sessionId", "itemIds", "confirmationClient"],
    ),
    "end_conversation": (
        "/api/v1/relance/tools/end-conversation",
        ["sessionId"],
    ),
}


class ContractsTest(unittest.TestCase):
    def test_neuf_outils_miroirs_dto(self):
        rt = _module()
        self.assertEqual(len(rt.TOOLS), 9)
        for tool in rt.TOOLS:
            path, required = EXPECTED[tool["name"]]
            self.assertEqual(tool["path"], path)
            schema = tool["parameters_schema"]
            self.assertEqual(schema["type"], "object")
            self.assertEqual(sorted(schema["required"]), sorted(required))

    def test_bornes_critiques(self):
        rt = _module()
        by_name = {t["name"]: t["parameters_schema"]["properties"] for t in rt.TOOLS}
        self.assertEqual(by_name["catalog_search"]["query"]["maxLength"], 120)
        self.assertEqual(by_name["confirm_rfq"]["idempotenceKey"]["minLength"], 8)
        self.assertIn("refused", by_name["record_call_outcome"]["outcome"]["enum"])
        self.assertEqual(by_name["request_human_handoff"]["motive"]["minLength"], 10)
        self.assertEqual(by_name["prepare_material_list"]["items"]["items"]["required"],
                         ["label", "qty", "unit"])
        self.assertEqual(by_name["record_recommendations"]["items"]["items"]["required"], ["label"])
        self.assertEqual(by_name["confirm_selections"]["confirmationClient"]["type"], "boolean")
        # catalog_search accepte une session optionnelle (UUID non requis)
        self.assertNotIn("sessionId", EXPECTED["catalog_search"][1])
        self.assertIn("sessionId", by_name["catalog_search"])

    def test_hote_public_refuse_local(self):
        rt = _module()
        for bad in ["", "http://example.com", "https://localhost:3001",
                    "https://127.0.0.1/", "https://10.0.0.5/", "https://192.168.1.2/"]:
            with self.assertRaises(ValueError, msg=bad):
                rt._public_base_url(bad)
        self.assertEqual(rt._public_base_url("https://api.example.com/"), "https://api.example.com")


class DryRunTest(unittest.TestCase):
    def test_dry_run_sans_reseau(self):
        rt = _module()
        with patch.object(rt.requests, "get", side_effect=AssertionError("réseau interdit")), \
             patch.object(rt.requests, "post", side_effect=AssertionError("réseau interdit")):
            actions = rt.register(dry_run=True, base_url="https://exemple-public.invalid")
        self.assertEqual(len(actions), 9)
        self.assertTrue(all(v == "create" for v, _, _ in actions))

    def test_main_dry_run_ne_fuit_pas_le_secret(self):
        rt = _module()
        buf = io.StringIO()
        with redirect_stdout(buf):
            code = rt.main([])
        self.assertEqual(code, 0)
        out = buf.getvalue()
        self.assertNotIn("secret-fictif-16-chars-minimum", out)
        self.assertNotIn("cle-fictive-pour-test", out)
        self.assertIn("(dry-run", out)

    def test_apply_sans_hote_public_refuse(self):
        rt = _module()
        self.assertEqual(rt.main(["--apply"]), 2)
        self.assertEqual(rt.main(["--apply", "--public-base-url", "http://x.example/"]), 2)


if __name__ == "__main__":
    unittest.main()
