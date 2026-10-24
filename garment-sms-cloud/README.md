# Garment ERP SMS gateway

Independent cloud: https://grm-bill-sms.telisoftware.com

This is a garment-owned copy of the KrishiBilling gateway design. No School ERP
or KrishiBilling source/service was modified. Cloud code and data are isolated:

- Code: /opt/teli-garment-sms/current
- Dedicated runtime: /opt/teli-garment-sms/venv
- Service/account: teli-garment-sms
- Database: /var/lib/teli-garment-sms/queue.sqlite
- Loopback port: 127.0.0.1:8792
- Nginx site: teli-garment-sms (separate certificate and renewal hook)
- Android package: in.telisoftware.garmentgateway
- App code: GARMENTERP

SMS requests use a dedicated Electron bridge to the local relay even when the
garment data connection is set to Cloud Server. Restart the desktop after updates
to load the new bridge. Automatic enqueue hooks run on local invoice persistence;
cloud-only invoice storage does not use those hooks.

## Desktop customer setup

1. Open Settings > SMS Gateway in the updated garment desktop app.
2. Select Register & Pair. Each desktop/tenant receives its own GRM code and
   encrypted credentials. Desktop subscription must be active.
3. Enter https://grm-bill-sms.telisoftware.com, the GRM organization code,
   GARMENTERP and the generated single-use code in Teli Garment Gateway.
4. Grant Android SMS permission and tap Start. Phone can use a different network.
5. Enable automatic invoice SMS if wanted and select English, Kannada or Both.
   Existing invoice previews and Quick Sales previews also offer Send SMS.
   Existing salary, payment, stock and order composers use the same queue.

Each pairing code expires after 10 minutes and authorizes one phone. Register
another phone with a fresh code. Revoke devices from desktop SMS settings.

## Reliability and scope

The new per-tenant desktop outbox stores pending messages before network calls.
Repeated source references return the existing job. New invoices are queued in
transaction with invoice/retail-ledger persistence when automatic SMS is enabled;
edits and print previews do not create another automatic message. Cloud claims
are atomic. Uncertain submissions are held for review, not automatically resent.
SUBMITTED means passed to Android SIM API, not recipient delivery confirmed.

New settings are separate from legacy SMS tables. Legacy pending SMS are not
silently uploaded; review them before resending. Credentials and pending work
are held/reset when transferred to a different machine. Windows desktop uses
Electron safeStorage; Node development uses a private AES key file.

This integration targets the desktop local API. The separate existing garment
SaaS server and school-order services were not deployed or replaced. Cloud SMS
self-registration is not independently subscription-verified; the desktop checks
its subscription before registration, queuing and upload. Messages already
uploaded may still send when a desktop subscription later expires.

## Build and tests

- node --test tests/garment-sms-relay.test.cjs
- node tests/garment-sms-http.test.cjs
- npm run build
- npm ci --prefix garment-gateway-app
- npm run build --prefix garment-gateway-app
- From garment-gateway-app: npx cap sync android
- From garment-gateway-app/android: gradlew.bat assembleDebug

The generated debug APK is for phone testing. A release signing key and real
SIM/phone test are required before customer distribution. No real customer SMS
was sent during implementation.

## Send SMS entry points

- Salary: immediately after recording salary, and saved salary slip/history preview.
- Invoices: saved-invoice confirmation and invoice view/print previews.
- Quick Sales: saved-sale confirmation (also when Save is used without Print), and receipt preview.
- Payments: payment receipt preview next to print/WhatsApp actions.
- Inventory: stock-issue SMS composer and generated invoice preview.
- Delivery: challan SMS actions and receipt preview.

Salary and payment messages use saved document amounts. Each composer lets the
user review/add a mobile number and choose English, Kannada or Both. Stable
source references prevent duplicate submissions. No SMS is sent just by opening
or printing a receipt. Missing phone numbers can be entered in the composer.
