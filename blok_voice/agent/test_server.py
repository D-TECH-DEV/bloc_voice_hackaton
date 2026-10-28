"""Tests du backend BLOK Voice Copilot (stdlib unittest, sans dépendance).

Lancez depuis la racine du dépôt :
    blok_voice/.venv/bin/python -m unittest discover -s blok_voice/agent -p "test_*.py"
"""
import json
import unittest
from unittest.mock import patch

import server


class FakeResponse:
    def __init__(self, status_code=200, payload=None, raw=""):
        self.status_code = status_code
        self._payload = payload
        self.text = raw if raw else (json.dumps(payload) if payload is not None else "")

    def json(self):
        if self._payload is None:
            raise ValueError("No JSON here")
        return self._payload


def _client(env_api="k", env_agent="a"):
    with patch.dict("os.environ", {"AETHEX_API_KEY": env_api, "AGENT_ID": env_agent}):
        import importlib
        importlib.reload(server)
    server.app.config["TESTING"] = True
    return server.app.test_client()


class HealthTest(unittest.TestCase):
    def test_health_ok(self):
        c = _client()
        r = c.get("/health")
        self.assertEqual(r.status_code, 200)
        body = r.get_json()
        self.assertEqual(body["status"], "ok")
        self.assertTrue(body["aethex_configured"])
        self.assertTrue(body["agent_configured"])

    def test_index_serves_page(self):
        c = _client()
        r = c.get("/")
        self.assertEqual(r.status_code, 200)
        html = r.get_data(as_text=True)
        self.assertIn("BLOK Voice Copilot", html)
        self.assertIn("startBtn", html)
        self.assertIn("endBtn", html)


class SessionTest(unittest.TestCase):
    def test_session_success_shape(self):
        c = _client()
        payload = {"session_id": "sid-1", "ice_config": {"iceServers": []}}
        with patch.object(server.requests, "post", return_value=FakeResponse(200, payload)):
            r = c.post("/session")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.get_json(), payload)

    def test_session_missing_key(self):
        with patch.dict("os.environ", {}, clear=False):
            import os
            os.environ.pop("AETHEX_API_KEY", None)
            os.environ.pop("API_KEY", None)
            import importlib
            importlib.reload(server)
        r = server.app.test_client().post("/session")
        self.assertEqual(r.status_code, 500)
        self.assertNotIn("ae_live", r.get_data(as_text=True))

    def test_session_upstream_404_maps_to_502_without_secret(self):
        c = _client()
        with patch.object(server.requests, "post",
                           return_value=FakeResponse(404, {"error": "Agent 'x' not found"})):
            r = c.post("/session")
        self.assertEqual(r.status_code, 502)
        body = r.get_data(as_text=True)
        self.assertIn("Agent", body)

    def test_session_non_json_upstream(self):
        c = _client()
        with patch.object(server.requests, "post",
                           return_value=FakeResponse(200, None, raw="<html>oops")):
            r = c.post("/session")
        self.assertEqual(r.status_code, 502)

    def test_session_timeout(self):
        import requests as rq
        c = _client()
        with patch.object(server.requests, "post", side_effect=rq.Timeout()):
            r = c.post("/session")
        self.assertEqual(r.status_code, 502)


class OfferTest(unittest.TestCase):
    def test_offer_success_passthrough(self):
        c = _client()
        answer = {"sdp": "v=0...", "type": "answer"}
        with patch.object(server.requests, "post", return_value=FakeResponse(200, answer)):
            r = c.post("/session/sid-1/offer", json={"sdp": "v=0...", "type": "offer"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.get_json(), answer)

    def test_offer_rejects_bad_body(self):
        c = _client()
        for bad in ({"sdp": "x"}, {"type": "offer"}, {"sdp": "x", "type": "answer"}, None):
            r = c.post("/session/sid-1/offer", json=bad)
            self.assertEqual(r.status_code, 400, msg=str(bad))

    def test_offer_unknown_session_maps_to_410(self):
        c = _client()
        with patch.object(server.requests, "post",
                           return_value=FakeResponse(404, {"error": "gone"})):
            r = c.post("/session/sid-1/offer", json={"sdp": "v=0...", "type": "offer"})
        self.assertEqual(r.status_code, 410)

    def test_offer_sends_only_sdp_fields(self):
        c = _client()
        seen = {}

        def fake_post(url, json=None, headers=None, timeout=None):
            seen.update(json or {})
            return FakeResponse(200, {"sdp": "v=0...", "type": "answer"})

        with patch.object(server.requests, "post", side_effect=fake_post):
            c.post("/session/sid-1/offer",
                   json={"sdp": "v=0...", "type": "offer", "evil": "x"})
        self.assertEqual(seen, {"sdp": "v=0...", "type": "offer"})
        self.assertNotIn("evil", seen)


if __name__ == "__main__":
    unittest.main()
