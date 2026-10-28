"""Contrat frontend/backend : la page vocale reste cohérente avec le serveur.

Lancez depuis blok_voice/agent :
    ../.venv/bin/python -m unittest test_frontend -v
"""
import os
import re
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
PAGE = os.path.join(HERE, "client.html")


def read_page():
    with open(PAGE, encoding="utf-8") as f:
        return f.read()


class FrontendContractTest(unittest.TestCase):
    def test_ids_references_existants(self):
        src = read_page()
        ids_html = set(re.findall(r'id="([^"]+)"', src))
        ids_js = set(re.findall(r'getElementById\("([^"]+)"', src))
        ids_js |= set(re.findall(r"querySelector\('#([\w-]+)'", src))
        self.assertTrue(ids_html, "la page doit définir des identifiants")
        self.assertEqual(ids_js - ids_html, set(),
                         "le JS référence des IDs absents du HTML")

    def test_boutons_et_indicateurs_presents(self):
        src = read_page()
        for rid in ("startBtn", "endBtn", "badge", "out", "error"):
            self.assertIn(f'id="{rid}"', src)

    @staticmethod
    def _correspond(route_modele, regles):
        # Compare segment par segment, les segments <...> étant génériques.
        seg_m = route_modele.strip("/").split("/")
        for regle in regles:
            seg_r = regle.strip("/").split("/")
            if len(seg_r) != len(seg_m):
                continue
            ok = all(a == b or (a.startswith("<") and a.endswith(">"))
                     for a, b in zip(seg_r, seg_m))
            if ok:
                return True
        return False

    def test_routes_appelees_existantes_cote_serveur(self):
        import server
        src = read_page()
        routes = {r.rule for r in server.app.url_map.iter_rules()}
        appels = re.findall(r'fetch\(\s*[`"]([^`"]+)[`"]', src)
        self.assertTrue(appels, "la page doit appeler le backend")
        for appel in appels:
            modele = re.sub(r"\$\{[^}]+\}", "<sid>", appel.split("?")[0])
            self.assertTrue(self._correspond(modele, routes),
                            f"route {appel} appelée mais absente du serveur")
        self.assertIn("/session", routes)
        self.assertIn("/health", routes)

    def test_aucun_secret_ni_hote_en_dur(self):
        src = read_page()
        self.assertNotIn("ae_live", src)
        self.assertEqual(re.findall(r"https?://[A-Za-z0-9.]+", src), [],
                         "la page ne doit pas contenir d'hôte en dur")
        self.assertEqual(re.findall(r"localhost:\d+", src), [],
                         "la page doit utiliser des chemins relatifs")


if __name__ == "__main__":
    unittest.main()
