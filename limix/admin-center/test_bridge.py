import io
import unittest
from types import SimpleNamespace
from unittest.mock import patch
import cloud_admin_bridge as bridge

class Handler:
    def __init__(self, headers=None, body=b""):
        self.headers = headers or {}
        self.rfile = io.BytesIO(body)
        self.result = None
    def send_json(self, body, status=200):
        self.result = (status, body)

class BridgeTests(unittest.TestCase):
    def test_other_routes_are_not_intercepted(self):
        self.assertFalse(bridge.handle(Handler(), None, lambda _: False, "/api/me", "GET"))
    def test_anonymous_cannot_read_cloud(self):
        h=Handler(); bridge.handle(h,None,lambda _:False,"/api/admin/cloud/requests","GET")
        self.assertEqual(h.result[0],401)
    def test_foreign_origin_cannot_change_cloud(self):
        h=Handler({"Origin":"https://foreign.example","Content-Type":"application/json"})
        bridge.handle(h,None,lambda _:True,"/api/admin/cloud/decision","POST")
        self.assertEqual(h.result[0],403)
    def test_unknown_action_is_rejected(self):
        h=Handler();bridge.handle(h,None,lambda _:True,"/api/admin/cloud/delete","POST")
        self.assertEqual(h.result[0],404)
    def test_invalid_decision_never_reaches_worker(self):
        body=b'{"principal":"limix:leox","decision":"delete"}'
        h=Handler({"Origin":bridge.ORIGIN,"Content-Type":"application/json","Content-Length":str(len(body))},body)
        bridge.handle(h,None,lambda _:True,"/api/admin/cloud/decision","POST")
        self.assertEqual(h.result[0],400)
    def test_redirect_cannot_forward_owner_bearer(self):
        self.assertIsNone(bridge.NoRedirect().redirect_request(None,None,302,"",{},"https://foreign.example"))
    def test_non_owner_cannot_authenticate(self):
        self.assertFalse(bridge.owner_credentials_ok(None,"customer","anything"))
    def test_master_password_matches_existing_account(self):
        db=SimpleNamespace(_limixbot_is_master_login=lambda _:True,_limixbot_master_password=lambda:"fixture")
        self.assertTrue(bridge.owner_credentials_ok(db,"leox","fixture"))
        self.assertFalse(bridge.owner_credentials_ok(db,"leox","wrong"))
    def test_disabled_master_does_not_accept_empty_password(self):
        db=SimpleNamespace(_limixbot_is_master_login=lambda _:True,_limixbot_master_password=lambda:"")
        self.assertFalse(bridge.owner_credentials_ok(db,"leox",""))
    def test_successful_request_keeps_credentials_on_server(self):
        db=SimpleNamespace(_limixbot_master_user=lambda:"leox",_limixbot_master_password=lambda:"fixture",_limixbot_master_token=lambda _:"fixture-token")
        response=SimpleNamespace(read=lambda _:b'{"requests":[]}',__enter__=lambda s:s,__exit__=lambda *a:None)
        class Response:
            def __enter__(self):return response
            def __exit__(self,*a):pass
        with patch.object(bridge.urllib.request,"build_opener") as opener:
            opener.return_value.open.return_value=Response()
            h=Handler();bridge.handle(h,db,lambda _:True,"/api/admin/cloud/requests","GET")
            self.assertEqual(h.result,(200,{"requests":[]}))
            request=opener.return_value.open.call_args.args[0]
            self.assertEqual(request.full_url,"https://cloud.limixmedia.com/api/cloud/owner/requests")
            self.assertNotIn("Cookie",request.headers)
            self.assertIn("fixture-token",request.headers["Authorization"])

if __name__ == "__main__":unittest.main()
