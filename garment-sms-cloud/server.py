"""Independent Teli Garment SMS queue. No TeliCampus dependencies.

WSGI application; run behind TLS using the supplied isolated systemd service.
Provision shop credentials locally on the server, never through a public route.
"""
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
import uuid
from contextlib import contextmanager
from urllib.parse import parse_qs

DB_PATH = os.environ.get('BILLING_SMS_DB', 'billing-sms.sqlite')
APP_CODE = 'GARMENTERP'


@contextmanager
def database():
    db = sqlite3.connect(DB_PATH, timeout=15)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def initialize():
    with database() as db:
        db.execute('PRAGMA journal_mode=WAL')
        db.executescript('''
        CREATE TABLE IF NOT EXISTS shops(
          code TEXT PRIMARY KEY, name TEXT NOT NULL, token_hash TEXT UNIQUE NOT NULL);
        CREATE TABLE IF NOT EXISTS enrollments(
          installation TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
          token_hash TEXT UNIQUE NOT NULL, approved INTEGER NOT NULL DEFAULT 0,
          created INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS devices(
          id TEXT PRIMARY KEY, shop TEXT NOT NULL REFERENCES shops(code), name TEXT NOT NULL,
          token_hash TEXT UNIQUE NOT NULL, installation TEXT NOT NULL,
          last_seen INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS pairings(
          code_hash TEXT PRIMARY KEY, shop TEXT NOT NULL REFERENCES shops(code),
          name TEXT NOT NULL, expires INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS jobs(
          id TEXT PRIMARY KEY, shop TEXT NOT NULL REFERENCES shops(code),
          reference TEXT NOT NULL, recipient_name TEXT NOT NULL, phone TEXT NOT NULL,
          message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING',
          device TEXT REFERENCES devices(id), created INTEGER NOT NULL,
          updated INTEGER NOT NULL, error TEXT, UNIQUE(shop, reference));
        CREATE INDEX IF NOT EXISTS queue_idx ON jobs(shop,status,created);
        CREATE TABLE IF NOT EXISTS login_attempts(
          address TEXT PRIMARY KEY, started INTEGER NOT NULL, attempts INTEGER NOT NULL);
        ''')


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def provision_shop(code, name):
    if not re.fullmatch(r'[A-Z0-9_-]{3,40}', code):
        raise ValueError('Use a unique uppercase shop code (3-40 characters).')
    token = secrets.token_urlsafe(40)
    with database() as db:
        db.execute('INSERT INTO shops VALUES(?,?,?)', (code, name, digest(token)))
    return {'shopCode': code, 'appCode': APP_CODE, 'token': token}



class ApiError(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message


def require(condition, message, status=400):
    if not condition:
        raise ApiError(status, message)


def authenticate(db, env, kind):
    header = env.get('HTTP_AUTHORIZATION', '')
    require(header.startswith('Bearer ') and len(header) < 256, 'Authentication required', 401)
    token_hash = digest(header[7:])
    if kind == 'shop':
        row = db.execute('SELECT * FROM shops WHERE token_hash=?', (token_hash,)).fetchone()
    else:
        row = db.execute('SELECT * FROM devices WHERE token_hash=? AND revoked=0', (token_hash,)).fetchone()
    require(row is not None, 'Invalid or revoked credentials', 401)
    if kind == 'device':
        db.execute('UPDATE devices SET last_seen=? WHERE id=?', (int(time.time()), row['id']))
    return row


def job_json(row):
    return {'id': row['id'], 'recipientName': row['recipient_name'],
            'recipientPhone': row['phone'], 'message': row['message'],
            'referenceType': 'BILL_GENERATED', 'referenceId': row['reference'],
            'status': row['status'], 'errorMessage': row['error'],
            'createdAt': row['created'], 'updatedAt': row['updated']}


def route(env, body):
    method, path = env['REQUEST_METHOD'], env.get('PATH_INFO', '')
    now = int(time.time())
    if method == 'GET' and path == '/health':
        return {'service': 'teli-garment-sms', 'status': 'ok'}
    if method == 'POST' and path == '/api/v1/billing/enrollments':
        installation = str(body.get('installationId', ''))
        name = str(body.get('shopName', '')).strip()
        header = env.get('HTTP_AUTHORIZATION', '')
        require(re.fullmatch(r'[a-f0-9-]{36}', installation), 'Valid installation UUID required')
        require(1 <= len(name) <= 100, 'Shop name required')
        require(header.startswith('Bearer ') and 40 <= len(header[7:]) <= 100, 'Registration credential required', 401)
        token_hash = digest(header[7:])
        with database() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT * FROM enrollments WHERE installation=?', (installation,)).fetchone()
            if row:
                require(hmac.compare_digest(row['token_hash'], token_hash), 'Installation already registered', 409)
                if not row['approved']:
                    db.execute('INSERT INTO shops VALUES(?,?,?)', (row['code'], row['name'], row['token_hash']))
                    db.execute('UPDATE enrollments SET approved=1 WHERE installation=?', (installation,))
                return {'shopCode': row['code'], 'status': 'APPROVED'}
            # Bound self-service registrations per source IP.
            address = 'enroll:' + (env.get('HTTP_X_FORWARDED_FOR', '') if env.get('REMOTE_ADDR') == '127.0.0.1' else env.get('REMOTE_ADDR', 'unknown'))
            db.execute('DELETE FROM login_attempts WHERE started < ?', (now - 3600,))
            attempts = db.execute('SELECT attempts FROM login_attempts WHERE address=?', (address,)).fetchone()
            require(not attempts or attempts['attempts'] < 10, 'Too many registrations; try later', 429)
            db.execute('INSERT INTO login_attempts VALUES(?,?,1) ON CONFLICT(address) DO UPDATE SET attempts=attempts+1', (address, now))
            code = 'GRM-' + secrets.token_hex(5).upper()
            db.execute('INSERT INTO enrollments VALUES(?,?,?,?,1,?)', (installation, code, name, token_hash, now))
            db.execute('INSERT INTO shops VALUES(?,?,?)', (code, name, token_hash))
            return {'shopCode': code, 'status': 'APPROVED'}
    # Persist failed pairing counts even when returning an error.
    if method == 'POST' and path == '/api/v1/gateway/auth/login':
        address = env.get('HTTP_X_FORWARDED_FOR') if env.get('REMOTE_ADDR') == '127.0.0.1' else env.get('REMOTE_ADDR', 'unknown')
        with database() as db:
            db.execute('BEGIN IMMEDIATE')
            db.execute('DELETE FROM login_attempts WHERE started < ?', (now - 900,))
            row = db.execute('SELECT attempts FROM login_attempts WHERE address=?', (address,)).fetchone()
            require(not row or row['attempts'] < 10, 'Too many pairing attempts; wait 15 minutes', 429)
            db.execute('INSERT INTO login_attempts VALUES(?,?,1) ON CONFLICT(address) DO UPDATE SET attempts=attempts+1', (address, now))
        require(body.get('appCode') == APP_CODE, 'Use app code GARMENTERP')
        code = str(body.get('deviceKey', '')).strip().upper()
        shop = str(body.get('schoolCode', '')).strip().upper()
        installation = str(body.get('installationId', ''))[:128]
        require(installation, 'Phone installation ID required')
        with database() as db:
            db.execute('BEGIN IMMEDIATE')
            pair = db.execute('SELECT * FROM pairings WHERE code_hash=? AND shop=? AND used=0 AND expires>?', (digest(code), shop, now)).fetchone()
            require(pair is not None, 'Pairing code invalid or expired', 401)
            token, device_id = secrets.token_urlsafe(40), str(uuid.uuid4())
            db.execute('UPDATE pairings SET used=1 WHERE code_hash=?', (digest(code),))
            db.execute('INSERT INTO devices(id,shop,name,token_hash,installation,last_seen) VALUES(?,?,?,?,?,?)', (device_id, shop, pair['name'], digest(token), installation, now))
            return {'token': token, 'deviceId': device_id, 'schoolCode': shop, 'appCode': APP_CODE}
    with database() as db:
        db.execute('BEGIN IMMEDIATE')
        if path.startswith('/api/v1/billing/'):
            shop = authenticate(db, env, 'shop')['code']
            require(not env.get('HTTP_X_SHOP_CODE') or hmac.compare_digest(shop, env['HTTP_X_SHOP_CODE']), 'Shop code does not match credentials', 401)
            if method == 'POST' and path == '/api/v1/billing/pairings':
                code = ''.join(secrets.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(6))
                db.execute('INSERT INTO pairings VALUES(?,?,?,?,0)', (digest(code), shop, str(body.get('deviceName', 'Billing SMS Phone'))[:80], now + 600))
                return {'pairingCode': code, 'expiresAt': now + 600, 'shopCode': shop, 'appCode': APP_CODE}
            if method == 'GET' and path == '/api/v1/billing/devices':
                return [dict(row) for row in db.execute('SELECT id,name,last_seen,revoked FROM devices WHERE shop=?', (shop,))]
            match = re.fullmatch(r'/api/v1/billing/devices/([^/]+)/revoke', path)
            if method == 'POST' and match:
                require(db.execute('UPDATE devices SET revoked=1 WHERE id=? AND shop=?', (match[1], shop)).rowcount, 'Device not found', 404)
                return {'status': 'REVOKED'}
            if method == 'POST' and path == '/api/v1/billing/jobs/sms':
                reference = str(body.get('referenceId', '')).strip()
                phone = re.sub(r'[^0-9+]', '', str(body.get('recipientPhone', '')))
                message = str(body.get('message', '')).strip()
                require(1 <= len(reference) <= 180, 'Unique invoice reference required')
                require(re.fullmatch(r'\+?[0-9]{10,15}', phone), 'Valid phone number required')
                require(1 <= len(message) <= 1000, 'Message must contain 1-1000 characters')
                old = db.execute('SELECT * FROM jobs WHERE shop=? AND reference=?', (shop, reference)).fetchone()
                if old:
                    require(old['phone'] == phone and old['message'] == message, 'Reference already used for different message', 409)
                    return {'jobId': old['id'], 'status': old['status'], 'alreadyQueued': True}
                job_id = str(uuid.uuid4())
                db.execute('INSERT INTO jobs(id,shop,reference,recipient_name,phone,message,created,updated) VALUES(?,?,?,?,?,?,?,?)', (job_id, shop, reference, str(body.get('recipientName', ''))[:100], phone, message, now, now))
                return {'jobId': job_id, 'status': 'PENDING'}
            if method == 'GET' and path == '/api/v1/billing/jobs':
                return [job_json(row) for row in db.execute('SELECT * FROM jobs WHERE shop=? ORDER BY created DESC LIMIT 100', (shop,))]
            match = re.fullmatch(r'/api/v1/billing/jobs/([^/]+)', path)
            if method == 'GET' and match:
                row = db.execute('SELECT * FROM jobs WHERE id=? AND shop=?', (match[1], shop)).fetchone()
                require(row is not None, 'Job not found', 404)
                return job_json(row)
        elif path.startswith('/api/v1/gateway/'):
            device = authenticate(db, env, 'device')
            shop, device_id = device['shop'], device['id']
            if method == 'GET' and path == '/api/v1/gateway/me':
                counts = {row['status']: row['n'] for row in db.execute('SELECT status,COUNT(*) AS n FROM jobs WHERE shop=? GROUP BY status', (shop,))}
                return {'schoolCode': shop, 'appCode': APP_CODE, 'pending': counts.get('PENDING', 0), 'sentToday': db.execute("SELECT COUNT(*) FROM jobs WHERE shop=? AND status='SUBMITTED' AND date(updated,'unixepoch','+330 minutes')=date(?,'unixepoch','+330 minutes')", (shop, now)).fetchone()[0], 'failed': counts.get('FAILED', 0)}
            if method == 'POST' and path == '/api/v1/gateway/heartbeat':
                return {'status': 'ok'}
            if method == 'GET' and path == '/api/v1/gateway/jobs/preview':
                return [job_json(row) for row in db.execute("SELECT * FROM jobs WHERE shop=? AND status='PENDING' ORDER BY created LIMIT 25", (shop,))]
            if method == 'GET' and path == '/api/v1/gateway/jobs':
                # Never automatically reassign an uncertain SMS: it may already have sent.
                db.execute("UPDATE jobs SET status='UNKNOWN',error='Phone did not acknowledge; review before resending',updated=? WHERE status='IN_PROGRESS' AND updated<?", (now, now - 300))
                row = db.execute("SELECT * FROM jobs WHERE shop=? AND status='PENDING' ORDER BY created LIMIT 1", (shop,)).fetchone()
                if not row:
                    return []
                db.execute("UPDATE jobs SET status='IN_PROGRESS',device=?,updated=? WHERE id=?", (device_id, now, row['id']))
                return [job_json(db.execute('SELECT * FROM jobs WHERE id=?', (row['id'],)).fetchone())]
            match = re.fullmatch(r'/api/v1/gateway/jobs/([^/]+)/status', path)
            if method == 'POST' and match:
                row = db.execute('SELECT * FROM jobs WHERE id=? AND shop=? AND device=?', (match[1], shop, device_id)).fetchone()
                require(row is not None, 'Job not found', 404)
                status = {'SENT': 'SUBMITTED', 'SUBMITTED': 'SUBMITTED', 'FAILED': 'FAILED', 'UNKNOWN': 'UNKNOWN'}.get(body.get('status'))
                require(status, 'Invalid job status')
                require(row['status'] in ('IN_PROGRESS', 'UNKNOWN', status), 'Job already finalized', 409)
                db.execute('UPDATE jobs SET status=?,error=?,updated=? WHERE id=?', (status, str(body.get('errorMessage', ''))[:250], now, row['id']))
                return {'status': status}
        raise ApiError(404, 'Route not found')


def application(env, start_response):
    if env.get('REQUEST_METHOD') in ('GET', 'HEAD') and env.get('PATH_INFO', '') == '/':
        from pathlib import Path
        data = Path(__file__).with_name('index.html').read_bytes()
        start_response('200 OK', [('Content-Type', 'text/html; charset=utf-8'), ('Content-Length', str(len(data))), ('Cache-Control', 'no-store'), ('X-Content-Type-Options', 'nosniff')])
        return [] if env['REQUEST_METHOD'] == 'HEAD' else [data]
    try:
        length = int(env.get('CONTENT_LENGTH') or '0')
        require(0 <= length <= 8192, 'Request too large', 413)
        raw = env['wsgi.input'].read(length) if length else b'{}'
        body = json.loads(raw)
        require(isinstance(body, dict), 'JSON object required')
        result = route(env, body)
        status = 200
    except ApiError as error:
        status, result = error.status, {'error': error.message}
    except (ValueError, UnicodeError):
        status, result = 400, {'error': 'Invalid request'}
    except Exception:
        status, result = 500, {'error': 'Service error; retry later'}
    data = json.dumps(result).encode()
    names = {200: 'OK', 400: 'Bad Request', 401: 'Unauthorized', 404: 'Not Found', 409: 'Conflict', 413: 'Payload Too Large', 429: 'Too Many Requests', 500: 'Internal Server Error'}
    start_response(f'{status} {names[status]}', [('Content-Type', 'application/json'), ('Content-Length', str(len(data))), ('Cache-Control', 'no-store'), ('X-Content-Type-Options', 'nosniff')])
    return [data]


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['init', 'create-shop', 'list-registrations'])
    parser.add_argument('--code')
    parser.add_argument('--name')
    args = parser.parse_args()
    initialize()
    if args.action == 'create-shop':
        print(json.dumps(provision_shop(args.code, args.name)))
    elif args.action == 'list-registrations':
        with database() as db:
            print(json.dumps([dict(row) for row in db.execute('SELECT code,name,installation,approved,created FROM enrollments ORDER BY created DESC')]))
