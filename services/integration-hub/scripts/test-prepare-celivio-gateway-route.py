#!/usr/bin/env python3
"""Dependency-free tests for the non-mutating API Gateway patcher."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

MODULE = Path(__file__).with_name("prepare-celivio-gateway-route.py")
spec = importlib.util.spec_from_file_location("celivio_patch", MODULE)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

BASE = """swagger: '2.0'
info:
  title: Example
  version: 1.0.0
host: integration-hub-oauth.example
x-google-backend:
  address: https://integration-hub-899273223001.southamerica-east1.run.app
  jwt_audience: https://integration-hub-899273223001.southamerica-east1.run.app
paths:
  /shopee/live/oauth/start:
    get:
      operationId: startViviane
      responses:
        '302':
          description: Redirect
  /shopee/live/oauth/adao/start:
    get:
      operationId: startAdao
      responses:
        '302':
          description: Redirect
  /shopee/live/oauth/callback:
    get:
      operationId: sharedCallback
      responses:
        '200':
          description: Connected
securityDefinitions:
  foo:
    type: apiKey
    name: key
    in: query
"""


class PatchTests(unittest.TestCase):
    def test_only_adds_one_route_and_keeps_existing_backend_and_callback(self):
        updated = mod.patch(BASE)
        self.assertIn("  /shopee/live/oauth/celivio/start:", updated)
        self.assertIn("operationId: shopeeCelivioOAuthStart", updated)
        self.assertIn("operationId: sharedCallback", updated)
        self.assertIn("jwt_audience: https://integration-hub-899273223001.southamerica-east1.run.app", updated)
        self.assertEqual(updated.count("/shopee/live/oauth/celivio/start:"), 1)
        self.assertEqual(updated.count("/shopee/live/oauth/adao/start:"), 1)
        self.assertEqual(updated.count("/shopee/live/oauth/start:"), 1)
        self.assertEqual(updated.count("/shopee/live/oauth/callback:"), 1)
        with self.assertRaisesRegex(ValueError, "already exists"):
            mod.patch(updated)

    def test_rejects_missing_or_ambiguous_existing_contract(self):
        for broken in (BASE.replace("  /shopee/live/oauth/callback:", "  /other:"),
                       BASE.replace("  /shopee/live/oauth/adao/start:", "  /other:"),
                       BASE.replace("  /shopee/live/oauth/adao/start:", "  /shopee/live/oauth/adao/start:\n  /shopee/live/oauth/adao/start:"),
                       BASE.replace("operationId: startAdao", "summary: no-identifier"),
                       BASE.replace("    get:\n      operationId: startAdao", "    post:\n      operationId: startAdao")):
            with self.subTest(broken=broken[:95]):
                with self.assertRaises(ValueError):
                    mod.patch(broken)

    def test_does_not_change_original_text_after_removing_insertion(self):
        updated = mod.patch(BASE)
        inserted = updated[updated.index("  /shopee/live/oauth/celivio/start:"):
                           updated.index("  /shopee/live/oauth/callback:")]
        self.assertEqual(updated.replace(inserted, "", 1), BASE)

    def test_requires_a_separate_output_file(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "current.yaml"
            source.write_text(BASE)
            target = Path(directory) / "prepared.yaml"
            updated = mod.patch(source.read_text())
            target.write_text(updated)
            self.assertEqual(source.read_text(), BASE)
            self.assertTrue(target.read_text().startswith("swagger:"))


if __name__ == "__main__":
    unittest.main()
