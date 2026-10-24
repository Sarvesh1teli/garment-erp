# Garment notification deployment status

Deployed on 16 October 2026 to the garment Uniform Order service only.

- Service: `school-uniform-order`
- Project: `/tmp/ubuntu/garment`
- API port: `18081`
- Database: `threadflow_school_orders`
- PWA: `https://garment.telisoftware.com/school-orders/`
- Firebase project: `garment-erp-9d0c2`
- Notification settings: garment-only `server/.env.notifications`, mode 600
- Private credential: garment-only `server/secrets/firebase-service-account.json`, mode 600
- Runtime/database backup: `/tmp/ubuntu/garment/.notification-backup-20261016-a`

No global Node upgrade, shared proxy restart, other application restart, or other application database change was performed. Firebase Admin 13 runs on the existing Node 20 service runtime. Frontend builds use the separately documented SDK build requirements.

Verified:

- Local TypeScript, PWA/worker, and desktop installer builds.
- Server action, authorization, rollback, device cleanup, and worker-targeting tests.
- Live garment health and notification tables.
- Live read-only authenticated school routes and unauthenticated access rejection.
- Firebase credential authentication and FCM dry-run validation with an intentionally invalid test token; no device notification sent.
- Public HTTPS Firebase config and bundled notification worker.

Remaining device check:

1. Refresh/reopen the school PWA to receive the new worker.
2. Sign in and choose Enable notifications, then Allow.
3. Accept a school order or use Send message to school in the updated garment desktop.
4. Check foreground notification history, background system alert, and opening the correct order. Repeat with another school to confirm isolation on actual devices.

Live notification delivery to an opted-in device has not yet been verified. Installation alone does not grant notification permission.
