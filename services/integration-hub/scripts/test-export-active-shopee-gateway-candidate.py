import base64
import importlib.util
import unittest
from pathlib import Path

DIRECTORY=Path(__file__).parent
def mod(name, filename):
    spec=importlib.util.spec_from_file_location(name,DIRECTORY/filename)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

exporter=mod("gateway_export","export-active-shopee-gateway-candidate.py")
patcher=mod("gateway_patch","prepare-universal-gateway-route.py")
source="""swagger: '2.0'
paths:
  /shopee/live/oauth/start:
    get:
      operationId: viviane
  /shopee/live/oauth/adao/start:
    get:
      operationId: adao
  /shopee/live/oauth/celivio/start:
    get:
      operationId: celivio
  /shopee/live/oauth/callback:
    get:
      operationId: callback
securityDefinitions:
  api_key:
    type: apiKey
"""
expected="/apis/integration-hub-oauth/configs/oauth-celivio-20261116-v1"
gateways=[{"name":"projects/test/locations/us-central1/gateways/integration-hub-oauth",
           "apiConfig":"projects/899273223001/locations/global"+expected,"state":"ACTIVE"}]
cfg={"name":"projects/899273223001/locations/global"+expected,
     "openapiDocuments":[{"document":{"contents":base64.b64encode(source.encode()).decode()}}]}

class ReadOnlyExport(unittest.TestCase):
    def test_verified_config_yields_minimal_local_candidate(self):
        current,candidate,attached=exporter.prepare_export(gateways,cfg,patcher.prepare)
        self.assertEqual(current,source)
        self.assertIn("  /shopee/live/oauth/universal/start:",candidate)
        self.assertIn("operationId: shopeeUniversalOAuthStart",candidate)
        self.assertTrue(attached.endswith(expected))
    def test_wrong_or_changed_published_config_fails(self):
        for changed in [
            [{**gateways[0],"apiConfig":"projects/1/locations/global/apis/integration-hub-oauth/configs/other"}],
            [{**gateways[0],"state":"FAILED"}],
            [],
            gateways+gateways,
        ]:
            with self.subTest(changed=changed):
                with self.assertRaises(ValueError):
                    exporter.prepare_export(changed,cfg,patcher.prepare)
    def test_missing_or_mismatched_openapi_fails(self):
        for changed in [
            {**cfg,"openapiDocuments":[]},
            {**cfg,"openapiDocuments":[{"document":{"contents":"!!!"}}]},
            {**cfg,"name":"projects/1/locations/global/apis/integration-hub-oauth/configs/other"},
        ]:
            with self.subTest(changed=changed):
                with self.assertRaises(ValueError):
                    exporter.prepare_export(gateways,changed,patcher.prepare)

if __name__=="__main__":
    unittest.main()
