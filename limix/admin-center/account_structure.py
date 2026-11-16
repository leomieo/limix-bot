"""Administrative organization registry; membership never grants Super Admin access."""
import json
import re
import sqlite3
from datetime import datetime, timezone

ROLES = {'owner', 'admin', 'member'}

def schema(conn):
    conn.executescript('''
    CREATE TABLE IF NOT EXISTS limix_admin_organizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS limix_admin_memberships (
      user_id INTEGER PRIMARY KEY, organization_id INTEGER NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('owner','admin','member')),
      updated_at TEXT NOT NULL,
      FOREIGN KEY(organization_id) REFERENCES limix_admin_organizations(id));
    CREATE TABLE IF NOT EXISTS limix_admin_structure_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT NOT NULL,
      action TEXT NOT NULL, details TEXT NOT NULL, created_at TEXT NOT NULL);
    ''')

def snapshot(db):
    conn = db.get_db()
    try:
        schema(conn)
        organizations = [dict(r) for r in conn.execute('SELECT o.id,o.name,o.created_at,COUNT(m.user_id) AS members FROM limix_admin_organizations o LEFT JOIN limix_admin_memberships m ON m.organization_id=o.id GROUP BY o.id ORDER BY o.name')]
        members = [dict(r) for r in conn.execute("SELECT u.id,u.username,u.email,u.status,u.plan,u.expires_at,m.organization_id,m.role,o.name AS organization FROM users u LEFT JOIN limix_admin_memberships m ON m.user_id=u.id LEFT JOIN limix_admin_organizations o ON o.id=m.organization_id WHERE u.status != 'deleted' ORDER BY u.username LIMIT 2001")]
        if len(members) > 2000:
            raise ValueError('too_many_users')
        audit = [dict(r) for r in conn.execute('SELECT actor,action,details,created_at FROM limix_admin_structure_audit ORDER BY id DESC LIMIT 50')]
        return {'ok': True, 'organizations': organizations, 'members': members, 'audit': audit,
                'super_admin': 'leox', 'organization_permissions_enforced': False}
    finally:
        conn.close()

def mutate(db, data):
    action = data.get('action')
    now = datetime.now(timezone.utc).isoformat()
    conn = db.get_db()
    try:
        schema(conn)
        with conn:
            if action == 'create_organization':
                name = data.get('name')
                if not isinstance(name, str) or not 1 <= len(name.strip()) <= 100 or any(ord(c) < 32 for c in name):
                    raise ValueError('invalid_name')
                name = name.strip()
                conn.execute('INSERT INTO limix_admin_organizations(name,created_at) VALUES (?,?)', (name, now))
                details = {'name': name}
            elif action in ('assign_member', 'remove_member'):
                uid = data.get('user_id')
                if type(uid) is not int or uid <= 0:
                    raise ValueError('invalid_user')
                user = conn.execute("SELECT username FROM users WHERE id=? AND status != 'deleted'", (uid,)).fetchone()
                if not user or user['username'].lower() == 'leox':
                    raise ValueError('protected_or_missing_user')
                existing = conn.execute('SELECT organization_id,role FROM limix_admin_memberships WHERE user_id=?', (uid,)).fetchone()
                if existing and existing['role'] == 'owner':
                    owners = conn.execute("SELECT COUNT(*) FROM limix_admin_memberships WHERE organization_id=? AND role='owner'", (existing['organization_id'],)).fetchone()[0]
                    keeps_role = action == 'assign_member' and data.get('role') == 'owner' and data.get('organization_id') == existing['organization_id']
                    if owners <= 1 and not keeps_role:
                        raise ValueError('last_owner')
                if action == 'remove_member':
                    conn.execute('DELETE FROM limix_admin_memberships WHERE user_id=?', (uid,))
                    details = {'user_id': uid}
                else:
                    org, role = data.get('organization_id'), data.get('role')
                    if type(org) is not int or role not in ROLES or not conn.execute('SELECT 1 FROM limix_admin_organizations WHERE id=?', (org,)).fetchone():
                        raise ValueError('invalid_membership')
                    count = conn.execute('SELECT COUNT(*) FROM limix_admin_memberships WHERE organization_id=?', (org,)).fetchone()[0]
                    if count == 0 and role != 'owner':
                        raise ValueError('first_member_must_own')
                    conn.execute('INSERT INTO limix_admin_memberships(user_id,organization_id,role,updated_at) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET organization_id=excluded.organization_id,role=excluded.role,updated_at=excluded.updated_at', (uid,org,role,now))
                    details = {'user_id':uid,'organization_id':org,'role':role}
            else:
                raise ValueError('invalid_action')
            conn.execute('INSERT INTO limix_admin_structure_audit(actor,action,details,created_at) VALUES (?,?,?,?)', ('leox',action,json.dumps(details),now))
        return {'ok': True}
    except sqlite3.IntegrityError:
        raise ValueError('duplicate_name') from None
    finally:
        conn.close()

def handle(handler, db, session_valid, path, method):
    if path not in ('/api/admin/structure', '/api/admin/account-plans'):
        return False
    def reply(body, status=200):
        handler.send_json(body,status)
        return True
    if not session_valid(handler.headers.get('Cookie','')):
        return reply({'error':'unauthorized'},401)
    try:
        if method == 'GET' and path == '/api/admin/structure':
            return reply(snapshot(db))
        if method == 'GET' and path == '/api/admin/account-plans':
            plans = {k:{kk:vv for kk,vv in v.items() if kk in ('name','days','price','amount','description')} for k,v in db.PLANS.items()}
            return reply({'ok':True,'plans':plans,'cloud_limits_enforced':False})
        if method != 'POST' or path != '/api/admin/structure':
            return reply({'error':'method_not_allowed'},405)
        if handler.headers.get('Origin') != 'https://admin.limixmedia.com' or handler.headers.get('Content-Type','').split(';')[0] != 'application/json':
            return reply({'error':'origin_not_allowed'},403)
        size = int(handler.headers.get('Content-Length','0'))
        if not 0 < size <= 4096:
            raise ValueError('invalid_request')
        data = json.loads(handler.rfile.read(size))
        if not isinstance(data,dict):
            raise ValueError('invalid_request')
        return reply(mutate(db,data))
    except (ValueError, TypeError) as error:
        return reply({'error':str(error) if str(error) in {'invalid_name','duplicate_name','invalid_user','protected_or_missing_user','last_owner','invalid_membership','first_member_must_own','invalid_action','too_many_users'} else 'invalid_request'},400)
