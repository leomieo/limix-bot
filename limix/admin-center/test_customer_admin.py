import io
import json
from pathlib import Path
import sqlite3
import tempfile
from types import SimpleNamespace
import unittest
import customer_admin as customer
import account_structure as structure

class CustomerTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.path=Path(self.temp.name)/'db.sqlite'
        def connect():
            c=sqlite3.connect(self.path);c.row_factory=sqlite3.Row;return c
        self.db=SimpleNamespace(get_db=connect,hash_password=lambda p:'hashed:'+p,PLANS={'basic':{'name':'Basic'},'monthly':{'name':'Monthly','days':30}})
        c=connect();c.executescript('''CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT,email TEXT,phone TEXT,status TEXT,plan TEXT,expires_at TEXT,password_hash TEXT);
        INSERT INTO users VALUES(1,'customer','customer@example.com','','active','basic','','old');
        INSERT INTO users VALUES(2,'leox','owner@example.com','','active','basic','','old');
        CREATE TABLE sessions(user_id INTEGER,token TEXT);INSERT INTO sessions VALUES(1,'fixture');
        CREATE TABLE limixbot_machines(user_id INTEGER,token_hash TEXT);INSERT INTO limixbot_machines VALUES(1,'fixture');''');c.commit();c.close()
    def tearDown(self):self.temp.cleanup()
    def update(self,**patch):return dict(action='update_account',user_id=1,email='new@example.com',phone='+84912345678',plan='monthly',max_devices=3,expires_at='2030-01-01T00:00:00+07:00',**patch)
    def test_update_sets_exact_plan_expiry_and_individual_device_limit(self):
        customer.mutate(self.db,self.update())
        row=customer.get_snapshot(self.db)['users'][0]
        self.assertEqual(row['email'],'new@example.com');self.assertEqual(row['max_devices'],3);self.assertEqual(row['expires_at'],'2030-01-01 00:00:00')
    def test_password_reset_revokes_sessions_without_logging_password(self):
        customer.mutate(self.db,self.update(new_password='fixture-password-123'))
        c=self.db.get_db();self.assertEqual(c.execute('SELECT COUNT(*) FROM sessions').fetchone()[0],0)
        self.assertIsNone(c.execute('SELECT token_hash FROM limixbot_machines').fetchone()[0])
        audit=c.execute('SELECT details FROM limix_customer_audit').fetchone()[0];self.assertNotIn('fixture-password',audit);c.close()
    def test_invalid_email_rolls_back(self):
        data=self.update();data['email']='bad'
        with self.assertRaises(ValueError):customer.mutate(self.db,data)
        self.assertEqual(customer.get_snapshot(self.db)['users'][0]['email'],'customer@example.com')
    def test_super_admin_cannot_be_changed(self):
        data=self.update();data['user_id']=2
        with self.assertRaises(ValueError):customer.mutate(self.db,data)
    def promotion(self):return dict(action='create_promotion',name='Launch',code='LIMIX10',percent=10,max_uses=1,starts_at='2020-01-01T00:00:00Z',ends_at='2090-01-01T00:00:00Z')
    def test_voucher_capacity_and_duplicate_protection(self):
        customer.mutate(self.db,self.promotion());pid=customer.get_snapshot(self.db)['promotions'][0]['id']
        customer.mutate(self.db,dict(action='grant_voucher',user_id=1,promotion_id=pid))
        with self.assertRaises(ValueError):customer.mutate(self.db,dict(action='grant_voucher',user_id=2,promotion_id=pid))
        self.assertEqual(customer.get_snapshot(self.db)['promotions'][0]['used'],1)
    def test_disabled_voucher_cannot_be_granted(self):
        customer.mutate(self.db,self.promotion());pid=customer.get_snapshot(self.db)['promotions'][0]['id']
        customer.mutate(self.db,dict(action='toggle_promotion',id=pid,enabled=False))
        with self.assertRaises(ValueError):customer.mutate(self.db,dict(action='grant_voucher',user_id=1,promotion_id=pid))
    def test_last_organization_owner_is_protected(self):
        structure.mutate(self.db,{'action':'create_organization','name':'Fixture'})
        org=structure.snapshot(self.db)['organizations'][0]['id']
        structure.mutate(self.db,{'action':'assign_member','user_id':1,'organization_id':org,'role':'owner'})
        with self.assertRaises(ValueError):structure.mutate(self.db,{'action':'remove_member','user_id':1})
    def test_roles_do_not_change_super_admin_access(self):
        structure.mutate(self.db,{'action':'create_organization','name':'Fixture'})
        self.assertFalse(structure.snapshot(self.db)['organization_permissions_enforced'])
    def test_customer_api_rejects_foreign_origin(self):
        class Handler:
            headers={'Origin':'https://foreign.invalid','Cookie':'fixture','Content-Type':'application/json'}
            def send_json(self,d,s):self.status=s
        h=Handler();customer.handle(h,self.db,lambda _:True,'/api/admin/customers','POST');self.assertEqual(h.status,403)

if __name__=='__main__':unittest.main()
