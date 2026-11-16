#!/usr/bin/python3
"""Private host-to-guest readiness and activation endpoint; no account data."""
import hmac
import json
import os
from pathlib import Path
import re
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

STATE = Path('/var/lib/limix-server')
CONFIG = Path('/etc/limix-server')

def command(*args):
    return subprocess.run(args, capture_output=True, text=True, timeout=15)

def snapshot():
    phase = (STATE / 'phase').read_text().strip() if (STATE / 'phase').exists() else 'booting'
    expected = json.loads((STATE / 'expected.json').read_text()) if (STATE / 'expected.json').exists() else []
    healthy = 0
    if (STATE / 'activated').exists():
        phase = 'starting'
        if any(not re.fullmatch(r'limix-home-[a-f0-9-]{36}-home-1', name) for name in expected):
            raise ValueError('Invalid expected container')
        if expected:
            result = command('docker', 'inspect', '--format', '{{.Name}} {{.State.Running}} {{.State.Health.Status}}', *expected)
            healthy = sum(1 for line in result.stdout.splitlines() if line.strip().endswith(' true healthy'))
        active = command('systemctl', 'is-active', '--quiet', 'limix-cloud-host.service').returncode == 0
        if active and healthy == len(expected):
            phase = 'ready'
    return {'installId': (CONFIG / 'install-id').read_text().strip(), 'phase': phase,
            'healthyHomes': healthy, 'expectedHomes': len(expected)}

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass
    def reply(self, value, status=200):
        data = json.dumps(value).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)
    def authorized(self):
        key = (CONFIG / 'health-key').read_text().strip()
        return hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + key)
    def do_GET(self):
        if not self.authorized():
            return self.reply({'error': 'unauthorized'}, 401)
        if self.path == '/logs':
            try:
                result = command('journalctl', '--no-pager', '-n', '80', '-u', 'limix-cloud-host.service', '-u', 'limix-cloud-bootstrap.service')
                text = result.stdout[-32000:]
                for line in (CONFIG / 'host.env').read_text().splitlines():
                    if line.startswith('LIMIX_BETA_HOST_TOKEN='):
                        text = text.replace(line.split('=', 1)[1], '[redacted]')
                text = text.replace((CONFIG / 'health-key').read_text().strip(), '[redacted]')
                return self.reply({'logs': text})
            except Exception:
                return self.reply({'error': 'logs_unavailable'}, 503)
        if self.path != '/healthz':
            return self.reply({'error': 'not_found'}, 404)
        try:
            self.reply(snapshot())
        except Exception:
            self.reply({'error': 'status_unavailable'}, 503)
    def do_POST(self):
        if not self.authorized():
            return self.reply({'error': 'unauthorized'}, 401)
        if self.path != '/activate':
            return self.reply({'error': 'not_found'}, 404)
        if not (STATE / 'prepared').exists():
            return self.reply({'error': 'not_prepared'}, 409)
        (STATE / 'activated').write_text('ok')
        result = command('systemctl', 'enable', '--now', 'limix-cloud-host.service')
        self.reply({'state': 'starting'} if result.returncode == 0 else {'error': 'start_failed'}, 202 if result.returncode == 0 else 503)

if __name__ == '__main__':
    STATE.mkdir(parents=True, exist_ok=True)
    os.chmod(STATE, 0o700)
    ThreadingHTTPServer(('0.0.0.0', 9876), Handler).serve_forever()
