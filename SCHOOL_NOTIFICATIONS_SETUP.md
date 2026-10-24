# School PWA notifications

## What is implemented

Desktop School Orders → View → Accept/Reject or Send message to school calls the cloud API. A database transaction saves the action, history, and school-specific notification together. The cloud API sends Firebase data messages to that school's registered devices. The PWA provides Enable notifications, Disable on this device, unread count, notification history, and links to the relevant order. Both server entry points use the same notification module.

Push is off by default. Local code/build completion does not activate the live website. This feature requires deploying the API and rebuilt PWA, configuring credentials, and testing on a real device.

## Configure the cloud server

1. Use Node 24.12 or newer for frontend builds (the installed Firebase 13 browser SDK requires it). The backend uses Firebase Admin 13, compatible with the garment server's existing Node 20; no global Node upgrade is required. The Docker images use Node 24 in their own containers. Keep the server's existing DATABASE_URL and JWT_SECRET.
2. Install server dependencies with `npm ci --prefix server`.
3. Copy `server/.env.notifications.example` to the garment-only `server/.env.notifications` file (chmod 600), or merge its settings into the service's private environment. The notification module reads only its four notification settings from this file and does not overwrite database/service settings. For systemd, use its existing EnvironmentFile; dotenv resolves from the process working directory. Use the complete Firebase web config and public VAPID key from the **same** Firebase project.
4. On Google hosting, prefer Application Default Credentials with an appropriately authorized service identity. On other hosting, create a dedicated service account with Firebase Cloud Messaging API Admin permission, store its JSON outside the repository/web root, readable only by the service user, and set GOOGLE_APPLICATION_CREDENTIALS to its absolute server path. Do not paste that file into chat, commit it, or copy it into the .exe/PWA.
5. Set SCHOOL_PUSH_ENABLED=true only when configuration and credentials are ready. Restart the API. The two notification tables/index are created automatically before it starts listening.

Deployment clues: `deploy-school/school-uniform-order.service` launches `school-order-server.js`; `deploy-school/Dockerfile.api` launches `index.js`. Both are supported; retain whichever deployment you already use. Do not start both against different databases expecting shared notifications.

For Docker, pass the three Firebase configuration environment values and mount the credential file read-only. Example **override** (merge into your existing compose deployment, substituting a real existing file):

```yaml
services:
  school-order-api:
    environment:
      SCHOOL_PUSH_ENABLED: "true"
      FIREBASE_WEB_CONFIG: ${FIREBASE_WEB_CONFIG}
      FIREBASE_VAPID_PUBLIC_KEY: ${FIREBASE_VAPID_PUBLIC_KEY}
      GOOGLE_APPLICATION_CREDENTIALS: /run/secrets/firebase.json
    volumes:
      - /absolute/private/path/firebase.json:/run/secrets/firebase.json:ro
```

## Build/deploy the school PWA

```powershell
npm ci
npm run school:build
```

Deploy the **entire dist-school directory**, including `firebase-messaging-sw.js`, `sw.js`, and hashed assets. Preserve the `/school-orders/` URL prefix. The runtime URL `/school-orders/firebase-config.js` must reach the API, never an HTML fallback or static file. It serves only whitelisted public client config. The server with the existing systemd reverse proxy handles it directly; the updated Docker nginx config proxies this URL explicitly.

The updated Docker web build also builds and installs the school PWA under that prefix. Use HTTPS. Disable caching for worker/config responses. Keep the Firebase web app's domain/API-key restrictions compatible with the actual school website. No private key belongs in frontend configuration.

The push worker shares the existing PWA scope and offline shell cache, replacing its previous worker registration. Its push code is bundled from the installed SDK; no external Firebase script CDN is required. Firebase itself needs network access.

## School setup and test

1. Sign in to the school PWA. Select **Enable notifications**, then Allow in the browser prompt. On supported iOS/iPadOS devices, install to Home Screen and launch there first.
2. Submit a uniform order. In the updated desktop, open that order and accept it.
3. Confirm only that school receives the alert; another school's device must not receive it. Test foreground, background, and clicking to open the order.
4. Test Send message to school, rejection, unread count/history, sign-out, and a second device. Signing out pauses local display and attempts to remove that device token; the school must sign in and enable notifications again.
5. Disconnect the school device, update an order, then reconnect. The history remains available even if push is missed. Browser/OS settings, connectivity, and platform support affect notification display; installed PWA status alone is insufficient.

If setup is missing, Enable notifications displays a configuration message. Accepted orders still save notification history without Firebase configuration. Queue failures retry and eventually mark failed; invalid tokens are removed. Push retries use stable notification tags to replace duplicate visible alerts. The inbox lists the latest 100 events; order timeline retains the action history.

## Checks

`node tests/school-push.test.cjs` checks public-secret separation, school/owner scoping, transactional event enqueue and rollback, and invalid actions. TypeScript, desktop/PWA builds, and syntax checks supplement these checks. A live Firebase/browser delivery test still needs configured credentials and deployed services.

## Operational limits

Keep existing cloud API authentication/reverse-proxy controls in place. Notification recipients are derived from the owner-scoped order in the database, never a school ID supplied by the desktop. This change does not replace the supplier identity/authentication system. Stored device tokens should be treated as sensitive operational data and excluded from logs/backups shared publicly.

Do not repeatedly press Send message while a request is in flight. Order acceptance/rejection cannot be repeated after the status transition. Arbitrary messages are separate timeline events; a deliberate resend creates another message. The queue records completion per event, not per device, so temporary retries may resend to devices that already received it; stable tags limit duplicate visible alerts.

Sources: [Firebase receiving web messages](https://firebase.google.com/docs/cloud-messaging/web/receive-messages), [Firebase sending/authentication](https://firebase.google.com/docs/cloud-messaging/send/v1-api).
