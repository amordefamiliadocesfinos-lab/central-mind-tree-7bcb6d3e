import importlib.util
from pathlib import Path
import unittest

SCRIPT=Path(__file__).with_name('check-shopee-universal-published-openapi.py')
spec=importlib.util.spec_from_file_location('published_openapi',SCRIPT)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def source(universal=True):
    routes=list(module.ROUTES.values())
    if not universal:
        routes.remove(module.ROUTES['universal'])
    return "openapi: 3.0.0\npaths:\n"+''.join(
        "  '"+r+"':\n    get:\n      operationId: "+str(i)+"\n" for i,r in enumerate(routes)
    )+"components:\n  schemas: {}\n"

class OpenApiPreflight(unittest.TestCase):
    def test_all_required_routes(self):
        ok,lines=module.inspect_openapi(source())
        self.assertTrue(ok,lines)
        self.assertTrue(any('universal/start' in s for s in lines))
    def test_absent_universal_route_blocks(self):
        ok,lines=module.inspect_openapi(source(False))
        self.assertFalse(ok)
        self.assertTrue(any('universal' in s for s in lines))
    def test_duplicate_route_blocks(self):
        ok,_=module.inspect_openapi(source()+ "  '/shopee/live/oauth/start':\n    get:\n")
        self.assertFalse(ok)
    def test_missing_get_blocks(self):
        ok,_=module.inspect_openapi(source().replace(
            "  '/shopee/live/oauth/callback':\n    get:",
            "  '/shopee/live/oauth/callback':\n    post:"))
        self.assertFalse(ok)

if __name__=='__main__':
    unittest.main()
