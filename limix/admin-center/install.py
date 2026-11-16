"""Apply the admin-center extension to an existing account-server directory."""
import ast
import shutil
import sys
import re
from datetime import datetime, timezone
from pathlib import Path

def install(root):
    source = Path(__file__).parent
    server = root / "gui_server.py"
    panel = root / "gui/admin_panel.html"
    database = root / "db_manager.py"
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
    cloud = (source / 'cloud-panel.html').read_text(encoding='utf-8')
    html = re.sub(r'<section class="section" id="tab-cloud">[\s\S]*?</script>\s*',lambda _:cloud.rstrip()+'\n',html,count=1)
    for key, filename in [('structure','structure-panel.html'),('customers','customer-panel.html')]:
        start='<!-- limix-'+key+'-start -->'
        end='<!-- limix-'+key+'-end -->'
        block=start+'\n'+(source/filename).read_text(encoding='utf-8')+'\n'+end
        if start in html:
            html=re.sub(re.escape(start)+r'[\s\S]*?'+re.escape(end),lambda _:block,html,count=1)
        else:
            html=html.replace(marker,marker+'\n'+block,1)
    shell_start='<!-- limix-shell-start -->';shell_end='<!-- limix-shell-end -->'
    shell=shell_start+'\n'+(source/'admin-shell.html').read_text(encoding='utf-8')+'\n'+shell_end
    if shell_start in html:
        html=re.sub(re.escape(shell_start)+r'[\s\S]*?'+re.escape(shell_end),lambda _:shell,html,count=1)
    else:
        html=html.replace('</body>',shell+'</body>')
    db_text=database.read_text(encoding='utf-8-sig')
    tree=ast.parse(db_text)
    node=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='limixbot_max_machines')
    replacement='''def limixbot_max_machines(user_id=None) -> int:
    if user_id is not None:
        conn = get_db()
        try:
            exists = conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='limix_account_limits'").fetchone()
            row = conn.execute("SELECT max_devices FROM limix_account_limits WHERE user_id=?", (user_id,)).fetchone() if exists else None
            if row:
                return max(1, min(1000, int(row[0])))
        finally:
            conn.close()
    try:
        return max(1, int(get_setting("limixbot_max_machines", "10")))
    except Exception:
        return 10'''
    db_text=db_text.replace(ast.get_source_segment(db_text,node),replacement)
    for node in ast.parse(db_text).body:
        if isinstance(node,ast.FunctionDef) and node.name in ('limixbot_login','limixbot_list_machines','limixbot_remove_machine'):
            original=ast.get_source_segment(db_text,node)
            db_text=db_text.replace(original,original.replace('limixbot_max_machines()', 'limixbot_max_machines(user["id"])'))
    ast.parse(db_text)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    for file in (server, panel, database):
        shutil.copy2(file, str(file) + ".bak-admin-center-" + stamp)
    shutil.copy2(source / "cloud_admin_bridge.py", root / "cloud_admin_bridge.py")
    for filename in ['account_structure.py','customer_admin.py']:
        shutil.copy2(source / filename,root / filename)
    server.write_text(text, encoding="utf-8")
    panel.write_text(html, encoding="utf-8")
    database.write_text(db_text,encoding='utf-8')
    print("Admin center installed; original files backed up.")

if __name__ == "__main__":
    install(Path(sys.argv[1]).resolve())
