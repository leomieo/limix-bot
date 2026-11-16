"""Apply the admin-center extension to an existing account-server directory."""
import ast
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

def install(root):
    source = Path(__file__).parent
    server = root / "gui_server.py"
    panel = root / "gui/admin_panel.html"
    text = server.read_text(encoding="utf-8-sig")
    html = panel.read_text(encoding="utf-8-sig")
    tree = ast.parse(text)
    node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "admin_credentials_ok")
    text = text.replace(ast.get_source_segment(text, node),
        'def admin_credentials_ok(username, password):\n    from cloud_admin_bridge import owner_credentials_ok\n    return VIP_ENABLED and owner_credentials_ok(db, username, password)')
    for method in ("GET", "POST"):
        handler = next(n for n in ast.walk(ast.parse(text)) if isinstance(n, ast.FunctionDef) and n.name == "do_" + method)
        lines = text.splitlines(keepends=True)
        if not any("cloud_admin_bridge" in line for line in lines[handler.lineno:handler.end_lineno]):
            hook = ('        from cloud_admin_bridge import handle as handle_cloud_admin\n'
                    '        if handle_cloud_admin(self, db, admin_session_valid, urllib.parse.urlparse(self.path).path, "' + method + '"):\n'
                    '            return\n')
            lines.insert(handler.lineno, hook)
            text = "".join(lines)
    lines = text.splitlines(keepends=True)
    for item in reversed(ast.parse(text).body):
        if isinstance(item, ast.Assign) and any(isinstance(t, ast.Name) and t.id in ("ADMIN_USERNAME", "ADMIN_PASSWORD") for t in item.targets):
            del lines[item.lineno - 1:item.end_lineno]
    text = "".join(lines)
    ast.parse(text)
    marker = '<div class="content">'
    if 'id="tab-cloud"' not in html:
        assert marker in html
        html = html.replace(marker, marker + "\n" + (source / "cloud-panel.html").read_text(encoding="utf-8"), 1)
        button = """<button class="tab-btn" onclick="showTab('cloud')">Limix Cloud</button>"""
        assert '<div class="tabs-bar">' in html
        html = html.replace('<div class="tabs-bar">', '<div class="tabs-bar">\n  ' + button, 1)
        assert "if(name==='settings') loadSettings();" in html
        html = html.replace("if(name==='settings') loadSettings();", "if(name==='settings') loadSettings();\n  if(name==='cloud') loadCloudRequests();")
        html = html.replace('</body>', "<script>window.addEventListener('load',()=>{if(location.hash==='#cloud')showTab('cloud')});</script></body>")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    for file in (server, panel):
        shutil.copy2(file, str(file) + ".bak-admin-center-" + stamp)
    shutil.copy2(source / "cloud_admin_bridge.py", root / "cloud_admin_bridge.py")
    server.write_text(text, encoding="utf-8")
    panel.write_text(html, encoding="utf-8")
    print("Admin center installed; original files backed up.")

if __name__ == "__main__":
    install(Path(sys.argv[1]).resolve())
