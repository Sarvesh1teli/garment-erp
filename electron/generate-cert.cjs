const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const selfsigned = require('selfsigned');

const dir = path.join(__dirname, '..', '.https');
const keyPath = path.join(dir, 'key.pem');
const certPath = path.join(dir, 'cert.pem');

function getLanIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

const lanIp = getLanIp();

if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  try {
    const cert = fs.readFileSync(certPath, 'utf8');
    if (cert.includes(lanIp)) {
      console.log(`Certificates already exist (includes LAN IP ${lanIp})`);
      process.exit(0);
    }
  } catch {}
}

if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const attrs = [{ name: 'commonName', value: 'localhost' }];
selfsigned.generate(attrs, {
  algorithm: 'sha256',
  days: 365,
  keySize: 2048,
  extensions: [
    { name: 'basicConstraints', cA: true },
    { name: 'subjectAltName', altNames: [
      { type: 2, value: 'localhost' },
      { type: 7, ip: '127.0.0.1' },
      { type: 7, ip: lanIp },
    ]},
  ],
}).then(pems => {
  fs.writeFileSync(keyPath, pems.private);
  fs.writeFileSync(certPath, pems.cert);
  console.log(`Certificate generated with LAN IP: ${lanIp}`);
}).catch(err => {
  console.error('Failed to generate certificate:', err.message);
  process.exit(1);
});
