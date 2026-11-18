import importlib.util
from pathlib import Path
import unittest

P = Path(__file__).with_name("prepare-universal-gateway-route.py")
spec = importlib.util.spec_from_file_location("universal_patch", P)
patcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(patcher)

BASE = """swagger: '2.0'
info:
  title: Production OAuth Gateway
  version: 1.0.0
host: integration-hub-oauth-bh4c23q1.ue.gateway.dev
x-google-backend:
  address: https://integration-hub.example.run.app
  jwt_audience: https://integration-hub.example.run.app
paths:
  /shopee/live/oauth/start:
    get:
      operationId: vivianeStart
      responses:
        '302':
          description: Redirect
  '/shopee/live/oauth/adao/start':
    get:
      operationId: adaoStart
      x-google-backend:
        address: https://integration-hub.example.run.app
      responses:
        '302':
          description: Redirect
  /shopee/live/oauth/celivio/start:
    get:
      operationId: celivioStart
      responses:
        '302':
          description: Redirect
  /shopee/live/oauth/callback:
    get:
      operationId: existingCallback
      responses:
        '200':
          description: Connected
securityDefinitions:
  existing:
    type: apiKey
    in: header
    name: x-api-key
"""

class UniversalPatchTests(unittest.TestCase):
    def test_only_inserts_universal_without_mutating_existing_yaml(self):
        after = patcher.prepare(BASE)
        self.assertIn("  '/shopee/live/oauth/universal/start':", after)
        self.assertIn("operationId: shopeeUniversalOAuthStart", after)
        self.assertEqual(after.count("operationId: existingCallback"), 1)
        self.assertEqual(after.count("jwt_audience:"), 1)
        self.assertIn("securityDefinitions:\n  existing:", after)
        original = patcher.inventory(BASE)
        new = patcher.inventory(after)
        for path in (patcher.START,patcher.ADAO,patcher.CELIVIO,patcher.CALLBACK):
            self.assertEqual(original[path][2],new[path][2])
        self.assertEqual(after.replace(new[patcher.UNIVERSAL][2], "", 1), BASE)
        with self.assertRaisesRegex(ValueError,"already exists"):
            patcher.prepare(after)

    def test_fails_closed_on_missing_or_duplicate_legacy_routes(self):
        broken = (
            BASE.replace("  /shopee/live/oauth/callback:", "  /missing:"),
            BASE.replace("  /shopee/live/oauth/celivio/start:", "  /missing:"),
            BASE.replace("  /shopee/live/oauth/start:", "  /other:"),
            BASE.replace("  '/shopee/live/oauth/adao/start':", "  /missing:"),
            BASE.replace("  /shopee/live/oauth/callback:", "  /shopee/live/oauth/callback:\n  /shopee/live/oauth/callback:"),
        )
        for sample in broken:
            with self.subTest(case=sample[-120:]):
                with self.assertRaises(ValueError):
                    patcher.prepare(sample)

    def test_rejects_unexpected_method_or_missing_operation_id(self):
        for sample in (
            BASE.replace("operationId: adaoStart", "summary: missing id"),
            BASE.replace("      operationId: adaoStart", "      operationId: adaoStart\n    post:\n      operationId: injection"),
            BASE.replace("    get:\n      operationId: adaoStart", "    post:\n      operationId: adaoStart"),
            BASE.replace("paths:", "routes:"),
        ):
            with self.assertRaises(ValueError):
                patcher.prepare(sample)

    def test_rejects_account_specific_backend_and_constant_translation(self):
        for fragment in (
            "        path_translation: CONSTANT_ADDRESS\n",
            "        address: https://integration-hub.example.run.app/shopee/live/oauth/adao/start\n",
        ):
            sample = BASE.replace("      x-google-backend:\n        address: https://integration-hub.example.run.app\n",
                                  "      x-google-backend:\n" + fragment)
            with self.subTest(fragment=fragment):
                with self.assertRaises(ValueError):
                    patcher.prepare(sample)

    def test_rejects_duplicate_operation_identifier(self):
        sample = BASE.replace("operationId: existingCallback","operationId: shopeeUniversalOAuthStart")
        with self.assertRaisesRegex(ValueError,"reserved"):
            patcher.prepare(sample)

if __name__=="__main__":
    unittest.main()
