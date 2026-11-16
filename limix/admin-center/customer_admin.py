"""Validated account overrides and promotional program administration."""
import json
import re
import sqlite3
from datetime import datetime, timedelta, timezone

def schema(conn):
    conn.executescript('''
    CREATE TABLE IF NOT EXISTS limix_account_limits(user_id INTEGER PRIMARY KEY,max_devices INTEGER NOT NULL CHECK(max_devices BETWEEN 1 AND 1000));
    CREATE TABLE IF NOT EXISTS limix_promotions(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,code TEXT NOT NULL UNIQUE,percent INTEGER NOT NULL CHECK(percent BETWEEN 1 AND 100),starts_at TEXT NOT NULL,ends_at TEXT NOT NULL,max_uses INTEGER NOT NULL CHECK(max_uses BETWEEN 1 AND 1000000),enabled INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS limix_voucher_grants(id INTEGER PRIMARY KEY AUTOINCREMENT,promotion_id INTEGER NOT NULL,user_id INTEGER NOT NULL,created_at TEXT NOT NULL,UNIQUE(promotion_id,user_id));
    CREATE TABLE IF NOT EXISTS limix_customer_audit(id INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT NOT NULL,action TEXT NOT NULL,details TEXT NOT NULL,created_at TEXT NOT NULL);
    ''')

def timestamp(value):
    if not isinstance(value,str):raise ValueError('invalid_date')
    result=datetime.fromisoformat(value.replace('Z','+00:00'))
    if result.tzinfo is None:raise ValueError('invalid_date')
    return result.astimezone(timezone.utc)

def audit(conn,action,details):
    conn.execute('INSERT INTO limix_customer_audit(actor,action,details,created_at) VALUES (?,?,?,?)',('leox',action,json.dumps(details),datetime.now(timezone.utc).isoformat()))

def get_snapshot(db):
    conn=db.get_db()
    try:
        schema(conn)
        return {'ok':True,'users':[dict(r) for r in conn.execute("SELECT u.id,u.username,u.email,u.phone,u.status,u.plan,u.expires_at,l.max_devices FROM users u LEFT JOIN limix_account_limits l ON l.user_id=u.id WHERE u.status != 'deleted' ORDER BY u.username LIMIT 2000")],
            'promotions':[dict(r) for r in conn.execute('SELECT p.*,COUNT(g.id) AS used FROM limix_promotions p LEFT JOIN limix_voucher_grants g ON g.promotion_id=p.id GROUP BY p.id ORDER BY p.id DESC LIMIT 500')],
            'audit':[dict(r) for r in conn.execute('SELECT actor,action,details,created_at FROM limix_customer_audit ORDER BY id DESC LIMIT 100')]}
    finally:conn.close()

def mutate(db,data):
    conn=db.get_db()
    try:
        schema(conn)
        now=datetime.now(timezone.utc)
        action=data.get('action')
        with conn:
            if action=='update_account':
                uid=data.get('user_id')
                if type(uid) is not int:raise ValueError('invalid_user')
                row=conn.execute("SELECT username FROM users WHERE id=? AND status != 'deleted'",(uid,)).fetchone()
                if not row or row['username'].lower()=='leox':raise ValueError('protected_user')
                email,phone=data.get('email'),data.get('phone')
                if not isinstance(email,str) or len(email)>254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email):raise ValueError('invalid_email')
                if not isinstance(phone,str) or len(phone)>30 or not re.fullmatch(r'[+0-9 ()-]*',phone):raise ValueError('invalid_phone')
                if conn.execute("SELECT 1 FROM users WHERE lower(email)=lower(?) AND id!=? AND status!='deleted'",(email,uid)).fetchone():raise ValueError('email_used')
                plan=data.get('plan');limit=data.get('max_devices');expires=data.get('expires_at')
                if plan not in db.PLANS or type(limit) is not int or not 1<=limit<=1000:raise ValueError('invalid_plan_or_limit')
                expiry=timestamp(expires)
                # Existing account dates are stored in Vietnam local time without a timezone suffix.
                local=expiry.astimezone(timezone(timedelta(hours=7))).strftime('%Y-%m-%d %H:%M:%S')
                password=data.get('new_password','')
                if not isinstance(password,str) or (password and not 10<=len(password)<=256):raise ValueError('password_length')
                conn.execute('UPDATE users SET email=?,phone=?,plan=?,expires_at=? WHERE id=?',(email.lower(),phone,plan,local,uid))
                conn.execute('INSERT INTO limix_account_limits(user_id,max_devices) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET max_devices=excluded.max_devices',(uid,limit))
                if password:
                    conn.execute('UPDATE users SET password_hash=? WHERE id=?',(db.hash_password(password),uid))
                    conn.execute('DELETE FROM sessions WHERE user_id=?',(uid,))
                    if conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='limixbot_machines'").fetchone():conn.execute('UPDATE limixbot_machines SET token_hash=NULL WHERE user_id=?',(uid,))
                    if conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='license_machines'").fetchone():conn.execute('DELETE FROM license_machines WHERE user_id=?',(uid,))
                audit(conn,action,{'user_id':uid,'plan':plan,'max_devices':limit,'password_reset':bool(password)})
            elif action=='create_promotion':
                name,code,percent,maximum=data.get('name'),data.get('code'),data.get('percent'),data.get('max_uses')
                if not isinstance(name,str) or not 1<=len(name.strip())<=100:raise ValueError('invalid_name')
                if not isinstance(code,str) or not re.fullmatch('[A-Z0-9_-]{4,40}',code):raise ValueError('invalid_code')
                if type(percent) is not int or not 1<=percent<=100 or type(maximum) is not int or not 1<=maximum<=1000000:raise ValueError('invalid_discount')
                starts,ends=timestamp(data.get('starts_at')),timestamp(data.get('ends_at'))
                if ends<=starts or ends<=now:raise ValueError('invalid_date')
                conn.execute('INSERT INTO limix_promotions(name,code,percent,starts_at,ends_at,max_uses,created_at) VALUES (?,?,?,?,?,?,?)',(name.strip(),code,percent,starts.isoformat(),ends.isoformat(),maximum,now.isoformat()))
                audit(conn,action,{'code':code,'percent':percent})
            elif action=='toggle_promotion':
                if type(data.get('id')) is not int or type(data.get('enabled')) is not bool:raise ValueError('invalid_request')
                result=conn.execute('UPDATE limix_promotions SET enabled=? WHERE id=?',(int(data['enabled']),data['id']))
                if not result.rowcount:raise ValueError('not_found')
                audit(conn,action,{'id':data['id'],'enabled':data['enabled']})
            elif action=='grant_voucher':
                uid,pid=data.get('user_id'),data.get('promotion_id')
                if type(uid) is not int or type(pid) is not int:raise ValueError('invalid_request')
                # Serialize count and assignment so concurrent requests cannot exceed max_uses.
                conn.execute('BEGIN IMMEDIATE')
                promo=conn.execute('SELECT * FROM limix_promotions WHERE id=?',(pid,)).fetchone()
                user=conn.execute("SELECT username FROM users WHERE id=? AND status='active'",(uid,)).fetchone()
                if not user or not promo or not promo['enabled'] or not timestamp(promo['starts_at'])<=now<timestamp(promo['ends_at']):raise ValueError('voucher_unavailable')
                if conn.execute('SELECT COUNT(*) FROM limix_voucher_grants WHERE promotion_id=?',(pid,)).fetchone()[0]>=promo['max_uses']:raise ValueError('voucher_limit')
                conn.execute('INSERT INTO limix_voucher_grants(promotion_id,user_id,created_at) VALUES (?,?,?)',(pid,uid,now.isoformat()))
                audit(conn,action,{'promotion_id':pid,'user_id':uid})
            else:raise ValueError('invalid_action')
        return {'ok':True}
    except sqlite3.IntegrityError:raise ValueError('duplicate_value') from None
    finally:conn.close()

def handle(handler,db,session_valid,path,method):
    if path!='/api/admin/customers':return False
    def reply(value,status=200):handler.send_json(value,status);return True
    if not session_valid(handler.headers.get('Cookie','')):return reply({'error':'unauthorized'},401)
    try:
        if method=='GET':return reply(get_snapshot(db))
        if method!='POST':return reply({'error':'method_not_allowed'},405)
        if handler.headers.get('Origin')!='https://admin.limixmedia.com' or handler.headers.get('Content-Type','').split(';')[0]!='application/json':return reply({'error':'origin_not_allowed'},403)
        size=int(handler.headers.get('Content-Length','0'))
        if not 0<size<=8192:raise ValueError('invalid_request')
        data=json.loads(handler.rfile.read(size))
        if not isinstance(data,dict):raise ValueError('invalid_request')
        return reply(mutate(db,data))
    except (ValueError,TypeError) as error:
        codes={'invalid_user','protected_user','invalid_email','invalid_phone','email_used','invalid_plan_or_limit','invalid_date','password_length','invalid_name','invalid_code','invalid_discount','invalid_request','not_found','voucher_unavailable','voucher_limit','invalid_action','duplicate_value'}
        return reply({'error':str(error) if str(error) in codes else 'invalid_request'},400)
