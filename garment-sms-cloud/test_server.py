import io
import json
import os
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
import server


class QueueTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        server.DB_PATH = os.path.join(self.directory.name, 'test.sqlite')
        server.initialize()
        self.shop = server.provision_shop('SHOP001', 'Shop One')['token']
        self.other = server.provision_shop('SHOP002', 'Shop Two')['token']

    def tearDown(self):
        self.directory.cleanup()

    def request(self, method, path, token=None, body=None):
        payload = json.dumps(body or {}).encode()
        env = {'REQUEST_METHOD': method, 'PATH_INFO': path, 'CONTENT_LENGTH': str(len(payload)), 'wsgi.input': io.BytesIO(payload), 'REMOTE_ADDR': 'test'}
        if token:
            env['HTTP_AUTHORIZATION'] = 'Bearer ' + token
        statuses = []
        result = b''.join(server.application(env, lambda status, headers: statuses.append(int(status.split()[0]))))
        return statuses[0], json.loads(result)

    def pair(self, installation='phone1'):
        _, pairing = self.request('POST', '/api/v1/billing/pairings', self.shop)
        body = {'appCode': 'GARMENTERP', 'schoolCode': 'SHOP001', 'deviceKey': pairing['pairingCode'], 'installationId': installation}
        status, result = self.request('POST', '/api/v1/gateway/auth/login', body=body)
        self.assertEqual(status, 200)
        self.assertEqual(self.request('POST', '/api/v1/gateway/auth/login', body=body)[0], 401)
        return result['token'], result['deviceId']

    def enqueue(self, reference='installation:invoice1:bill-generated'):
        return self.request('POST', '/api/v1/billing/jobs/sms', self.shop, {'referenceId': reference, 'recipientPhone': '9999999999', 'message': 'Test bill only'})

    def test_isolation_idempotency_and_revocation(self):
        phone, device_id = self.pair()
        status, job = self.enqueue()
        self.assertEqual(status, 200)
        self.assertEqual(self.enqueue()[1]['jobId'], job['jobId'])
        self.assertEqual(self.request('GET', '/api/v1/billing/jobs/' + job['jobId'], self.other)[0], 404)
        self.assertEqual(self.request('GET', '/api/v1/billing/jobs', phone)[0], 401)
        self.assertEqual(len(self.request('GET', '/api/v1/gateway/jobs/preview', phone)[1]), 1)
        self.assertEqual(len(self.request('GET', '/api/v1/gateway/jobs', phone)[1]), 1)
        self.assertEqual(self.request('GET', '/api/v1/gateway/jobs', phone)[1], [])
        self.assertEqual(self.request('POST', '/api/v1/gateway/jobs/' + job['jobId'] + '/status', phone, {'status': 'SUBMITTED'})[0], 200)
        self.assertEqual(self.request('GET', '/api/v1/billing/jobs/' + job['jobId'], self.shop)[1]['status'], 'SUBMITTED')
        self.request('POST', '/api/v1/billing/devices/' + device_id + '/revoke', self.shop)
        self.assertEqual(self.request('GET', '/api/v1/gateway/jobs', phone)[0], 401)

    def test_concurrent_claims_and_uncertain_jobs(self):
        first, _ = self.pair()
        second, _ = self.pair('phone2')
        self.enqueue()
        with ThreadPoolExecutor(2) as pool:
            results = list(pool.map(lambda token: self.request('GET', '/api/v1/gateway/jobs', token)[1], [first, second]))
        self.assertEqual(sum(len(result) for result in results), 1)
        with server.database() as db:
            db.execute('UPDATE jobs SET updated=0')
        self.assertEqual(self.request('GET', '/api/v1/gateway/jobs', first)[1], [])
        self.assertEqual(self.request('GET', '/api/v1/billing/jobs', self.shop)[1][0]['status'], 'UNKNOWN')

    def test_auth_and_validation(self):
        self.assertEqual(self.request('POST', '/api/v1/billing/jobs/sms')[0], 401)
        self.assertEqual(self.request('POST', '/api/v1/billing/jobs/sms', self.shop, {})[0], 400)
        for _ in range(10):
            self.request('POST', '/api/v1/gateway/auth/login', body={})
        self.assertEqual(self.request('POST', '/api/v1/gateway/auth/login', body={})[0], 429)

    def test_homepage(self):
        statuses = []
        html = b''.join(server.application({'REQUEST_METHOD': 'GET', 'PATH_INFO': '/'}, lambda status, headers: statuses.append((status, dict(headers)))))
        self.assertEqual(statuses[0][0], '200 OK')
        self.assertIn('text/html', statuses[0][1]['Content-Type'])
        self.assertIn(b'Register & Pair', html)

    def test_customer_installations_register_without_manual_approval(self):
        import secrets
        import uuid
        token = secrets.token_urlsafe(40)
        payload = {'installationId': str(uuid.uuid4()), 'shopName': 'Customer One'}
        status, result = self.request('POST', '/api/v1/billing/enrollments', token, payload)
        self.assertEqual(status, 200)
        self.assertEqual(result['status'], 'APPROVED')
        self.assertEqual(self.request('POST', '/api/v1/billing/pairings', token)[0], 200)
        self.assertEqual(self.request('POST', '/api/v1/billing/enrollments', token, payload)[1]['status'], 'APPROVED')
        self.assertEqual(self.request('GET', '/api/v1/billing/jobs', token)[0], 200)
        self.assertEqual(self.request('POST', '/api/v1/billing/enrollments', secrets.token_urlsafe(40), payload)[0], 409)
        second = self.request('POST', '/api/v1/billing/enrollments', secrets.token_urlsafe(40), {'installationId': str(uuid.uuid4()), 'shopName': 'Customer Two'})[1]
        self.assertNotEqual(second['shopCode'], result['shopCode'])


if __name__ == '__main__':
    unittest.main()
