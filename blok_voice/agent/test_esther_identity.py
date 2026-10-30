"""Identité officielle ESTHER de l'agente vocale BLOK Relance.

Vérifie le contrat d'identité de bout en bout, sans aucun appel réseau
(les appels AethexAI sont simulés) :
- le nom officiel de l'agent est ESTHER ;
- la présentation officielle est transmise comme premier message vocal,
  à la création comme lors de la synchronisation d'un agent existant
  (y compris un ancien agent portant l'ancien nom) ;
- le prompt système impose l'identité ESTHER, la présentation unique
  en début de conversation et ne mentionne aucun ancien nom ;
- l'interface servie par server.py affiche ESTHER ;
- les 9 outils commerciaux restent déclarés (l'identité ne les bloque pas).

Lancez depuis la racine du dépôt :
    blok_voice/.venv/bin/python -m unittest discover -s blok_voice/agent -p "test_*.py"
"""
import importlib
import os
import unittest
from unittest.mock import patch

HERE = os.path.dirname(os.path.abspath(__file__))


def _read(name):
    with open(os.path.join(HERE, name), encoding="utf-8") as f:
        return f.read()


# Présentation officielle de référence (mission ESTHER §2).
PRESENTATION_OFFICIELLE = (
    "Bonjour et bienvenue chez BLOK ! "
    "Je suis ESTHER, votre agente commerciale virtuelle. "
    "Je suis là pour vous accompagner dans votre recherche de matériaux "
    "de construction et répondre à vos besoins. "
    "Que puis-je faire pour vous aujourd'hui ?"
)

REPONSE_NOM_ATTENDUE = "Je m'appelle ESTHER"

NOMS_INTERDITS = ("Nadège", "Nadege", "Copilot", "BLOK Voice Copilot")


def _agent_module():
    # create_agent.py n'exécute aucun appel réseau à l'import :
    # tout passe par main() / les fonctions unitaires.
    with patch.dict("os.environ", {"AETHEX_API_KEY": "cle-fictive"}, clear=False):
        import create_agent
        importlib.reload(create_agent)
    return create_agent


class FakeResponse:
    def __init__(self, status_code=200, payload=None, raw=""):
        self.status_code = status_code
        self._payload = payload
        self.text = raw if raw else "{}"

    def raise_for_status(self):
        if self.status_code >= 400:
            import requests as rq
            raise rq.HTTPError(f"HTTP {self.status_code}")

    def json(self):
        return self._payload if self._payload is not None else {}


class IdentiteEstherTest(unittest.TestCase):
    def test_nom_officiel_agent(self):
        ca = _agent_module()
        self.assertEqual(ca.AGENT_NAME, "ESTHER")

    def test_presentation_officielle_exacte(self):
        ca = _agent_module()
        self.assertEqual(ca.FIRST_MESSAGE, PRESENTATION_OFFICIELLE)

    def test_payload_creation_porte_identite_esther(self):
        ca = _agent_module()
        payload = ca.build_agent_payload("voix-test")
        self.assertEqual(payload["name"], "ESTHER")
        self.assertEqual(payload["first_message"], PRESENTATION_OFFICIELLE)
        self.assertEqual(payload["system_prompt"], ca.SYSTEM_PROMPT)
        self.assertEqual(payload["language"], "french")
        self.assertEqual(payload["voice_id"], "voix-test")

    def test_synchronisation_agent_existant_renvoie_presentation(self):
        ca = _agent_module()
        seen = {}

        def fake_request(method, url, headers=None, timeout=None, json=None):
            seen["method"] = method
            seen["url"] = url
            seen["json"] = json
            return FakeResponse(200, {"id": "agent-1"})

        with patch.object(ca.requests, "request", side_effect=fake_request):
            ca.update_agent("cle-fictive", "agent-1", "voix-1")
        self.assertEqual(seen["method"], "patch")
        self.assertIn("agent-1", seen["url"])
        self.assertEqual(seen["json"]["name"], "ESTHER")
        self.assertEqual(seen["json"]["first_message"], PRESENTATION_OFFICIELLE)
        self.assertEqual(seen["json"]["system_prompt"], ca.SYSTEM_PROMPT)

    def test_agent_ancien_nom_repris_puis_renomme(self):
        ca = _agent_module()

        class FakeList(FakeResponse):
            def json(self):
                return {"data": [{"name": "BLOK Voice Copilot", "id": "ancien-id"}]}

        with patch.object(ca.requests, "get", return_value=FakeList()):
            self.assertEqual(ca.find_existing_agent("cle-fictive"), "ancien-id")

    def test_prompt_systeme_impose_identite_esther(self):
        ca = _agent_module()
        self.assertIn("Tu es ESTHER", ca.SYSTEM_PROMPT)
        self.assertIn(REPONSE_NOM_ATTENDUE, ca.SYSTEM_PROMPT)
        self.assertRegex(ca.SYSTEM_PROMPT, r"(?i)une seule fois")

    def test_prompt_systeme_sans_ancien_nom(self):
        ca = _agent_module()
        for interdit in NOMS_INTERDITS:
            self.assertNotIn(interdit, ca.SYSTEM_PROMPT,
                             f"l'ancien nom {interdit!r} ne doit jamais être "
                             "transmis au modèle vocal, même dans une interdiction")

    def test_contexte_metier_materiaux(self):
        ca = _agent_module()
        prompt = ca.SYSTEM_PROMPT.lower()
        for materiau in ("ciment", "fer à béton", "gravier", "sable"):
            self.assertIn(materiau, prompt)

    def test_regle_anti_invention_conservee(self):
        ca = _agent_module()
        self.assertRegex(ca.SYSTEM_PROMPT, r"(?i)ne dois jamais inventer")
        self.assertIn("catalog_search", ca.SYSTEM_PROMPT)

    def test_prompt_prevoit_devis_fin_conversation(self):
        ca = _agent_module()
        self.assertIn("Souhaitez-vous que je prépare votre devis", ca.SYSTEM_PROMPT)
        self.assertIn("confirm_selections", ca.SYSTEM_PROMPT)
        self.assertIn("end_conversation", ca.SYSTEM_PROMPT)
        self.assertRegex(ca.SYSTEM_PROMPT, r"(?i)ne calcule jamais toi-même")
        self.assertIn("Votre devis est prêt", ca.SYSTEM_PROMPT)


class InterfaceEstherTest(unittest.TestCase):
    def test_page_client_affiche_esther(self):
        html = _read("client.html")
        self.assertIn("ESTHER", html)
        for interdit in ("BLOK Voice Copilot", "Nadège", "Nadege"):
            self.assertNotIn(interdit, html)

    def test_page_client_sans_secret_ni_hote_en_dur(self):
        html = _read("client.html")
        self.assertNotIn("ae_live", html)


class OutilsEstherTest(unittest.TestCase):
    def test_neuf_outils_toujours_declares(self):
        env = {
            "AETHEX_API_KEY": "cle-fictive-pour-test",
            "AGENT_ID": "agent-fictif",
            "VOICE_TOOL_SECRET": "secret-fictif-16-chars-minimum",
        }
        with patch.dict("os.environ", env, clear=False):
            import register_tools
            importlib.reload(register_tools)
        noms = sorted(t["name"] for t in register_tools.TOOLS)
        self.assertEqual(noms, sorted([
            "catalog_search", "record_recommendations", "confirm_selections",
            "end_conversation", "prepare_material_list", "confirm_rfq",
            "record_call_outcome", "record_voice_opt_out",
            "request_human_handoff",
        ]))


if __name__ == "__main__":
    unittest.main()
