"""Owner-only adapter between the account admin session and Cloud control plane."""
import base64
import json
import urllib.request
import urllib.error

OWNER = "leox"
ORIGIN = "https://admin.limixmedia.com"

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def owner_credentials_ok(db, username, password):
    import hmac
    if not isinstance(username, str) or not isinstance(password, str):
        return False
    login = username.strip()
    if login.lower() != OWNER:
        return False
    if db._limixbot_is_master_login(login):
        expected = db._limixbot_master_password()
        return bool(expected) and hmac.compare_digest(password.encode(), expected.encode())
    conn = db.get_db()
    try:
        user, error = db._limixbot_check_user(conn, login, password)
        return error is None and user is not None and user["username"].lower() == OWNER
    finally:
        conn.close()

def handle(handler, db, session_valid, path, method):
    from customer_admin import handle as customer_handle
    if customer_handle(handler, db, session_valid, path, method):
        return True
    from account_structure import handle as structure_handle
    if structure_handle(handler, db, session_valid, path, method):
        return True
    routes = {("GET", "/api/admin/cloud/requests"): "requests", ("POST", "/api/admin/cloud/decision"): "decision", ("GET", "/api/admin/cloud/resources"): "resources", ("POST", "/api/admin/cloud/resources"): "resources"}
    if not path.startswith("/api/admin/cloud/"):
        return False
    def reply(value, status):
        handler.send_json(value, status)
        return True
    if not session_valid(handler.headers.get("Cookie", "")):
        return reply({"error": "unauthorized"}, 401)
    route = routes.get((method, path))
    if not route:
        return reply({"error": "not_found"}, 404)
    body = None
    if method == "POST":
        if handler.headers.get("Origin") != ORIGIN or handler.headers.get("Content-Type", "").split(";")[0] != "application/json":
            return reply({"error": "origin_not_allowed"}, 403)
        try:
            size = int(handler.headers.get("Content-Length", "0"))
            if not 0 < size <= 4096:
                raise ValueError()
            body = json.loads(handler.rfile.read(size))
            import re
            if not isinstance(body, dict) or not isinstance(body.get("principal"), str) or not re.fullmatch(r"limix:[A-Za-z0-9_.@-]{1,100}", body["principal"]):
                raise ValueError()
            if route == "decision" and body.get("decision") not in ("approve", "decline", "revoke"):
                raise ValueError()
            if route == "resources" and body.get("reset") is not True and (type(body.get("cpus")) is not int or not 1 <= body["cpus"] <= 16 or type(body.get("memory_gb")) is not int or not 2 <= body["memory_gb"] <= 32):
                raise ValueError()
        except (ValueError, TypeError):
            return reply({"error": "invalid_request"}, 400)
    # The browser's cookie never leaves this server; the Worker separately verifies the Limix owner.
    if db._limixbot_master_user().lower() != OWNER or not db._limixbot_master_password():
        return reply({"error": "owner_cloud_credential_unavailable"}, 503)
    machine = "limix-admin-center"
    token = db._limixbot_master_token(machine)
    encoded = base64.urlsafe_b64encode(machine.encode()).decode().rstrip("=")
    request = urllib.request.Request("https://cloud.limixmedia.com/api/cloud/owner/" + route,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"User-Agent": "LimixBot-Admin/0.3.55", "Authorization": "Bearer limix." + encoded + "." + token, "Content-Type": "application/json"}, method=method)
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=25) as response:
            result = json.loads(response.read(2_000_000))
        return reply(result, 200)
    except urllib.error.HTTPError as error:
        return reply({"error": "cloud_request_rejected", "status": error.code}, 502)
    except (urllib.error.URLError, TimeoutError, ValueError, OSError):
        return reply({"error": "cloud_unreachable"}, 503)
