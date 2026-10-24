#!/bin/sh
set -eu
# New dedicated paths only. Refuse to overwrite an existing deployment.
test ! -e /opt/teli-garment-sms
test ! -e /var/lib/teli-garment-sms
test ! -e /etc/systemd/system/teli-garment-sms.service
if ss -ltn | grep -q ':8792 '; then echo 'Port 8792 is occupied'; exit 1; fi
id teli-garment-sms >/dev/null 2>&1 && { echo 'Service account already exists'; exit 1; }
useradd --system --home /var/lib/teli-garment-sms --shell /usr/sbin/nologin teli-garment-sms
install -d -m 755 /opt/teli-garment-sms/current
install -d -o teli-garment-sms -g teli-garment-sms -m 700 /var/lib/teli-garment-sms
install -m 644 /tmp/teli-garment-sms-upload/server.py /opt/teli-garment-sms/current/server.py
install -m 644 /tmp/teli-garment-sms-upload/index.html /opt/teli-garment-sms/current/index.html
install -m 644 /tmp/teli-garment-sms-upload/test_server.py /opt/teli-garment-sms/current/test_server.py
install -m 644 /tmp/teli-garment-sms-upload/requirements.txt /opt/teli-garment-sms/current/requirements.txt
# Bootstrap a private Python environment without installing/upgrading OS packages.
python3 /tmp/teli-garment-sms-upload/virtualenv.pyz /opt/teli-garment-sms/venv
/opt/teli-garment-sms/venv/bin/pip install --disable-pip-version-check -r /opt/teli-garment-sms/current/requirements.txt
cd /opt/teli-garment-sms/current
runuser -u teli-garment-sms -- /opt/teli-garment-sms/venv/bin/python -m unittest -v
runuser -u teli-garment-sms -- env BILLING_SMS_DB=/var/lib/teli-garment-sms/queue.sqlite /opt/teli-garment-sms/venv/bin/python server.py init
install -m 644 /tmp/teli-garment-sms-upload/teli-garment-sms.service /etc/systemd/system/teli-garment-sms.service
systemctl daemon-reload
systemctl enable --now teli-garment-sms.service
curl --retry 5 --retry-connrefused --retry-delay 1 --fail --silent http://127.0.0.1:8792/health
