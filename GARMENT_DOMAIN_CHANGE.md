# Garment domain change

Changed on 17 October 2026.

- School PWA: https://garment.telisoftware.com/school-orders/
- Cloud API: https://garment.telisoftware.com
- Existing garment service remains school-uniform-order on port 18081 and the same database.
- DNS points to the existing server; a certificate for the new hostname has been issued and installed.
- Only a new garment Nginx virtual host was added; other application configurations were not modified. Nginx was gracefully reloaded, not restarted.
- The old garment endpoint remains available for older clients.
- Desktop cloud defaults and displayed URLs use the new domain. Saved overrides for the exact old cloud hostname migrate automatically; local/custom backend addresses remain unchanged.

Schools should open the new URL, sign in, install the PWA from that URL, and choose Enable notifications again. Browser login, installation identity, permission, and push registration are origin-specific and do not transfer automatically from the old domain. Existing order data remains on the same server/database.

Verified new-domain HTTPS routes: school-orders/, api/health, school-orders/firebase-config.js, school-orders/firebase-messaging-sw.js. Desktop source migration and school PWA builds passed.

The new virtual-host configuration is in deploy-school/garment.telisoftware.com.conf. The certificate files referenced there are server-managed and must never be copied into the desktop app.

Desktop installer build completed successfully. The new domain's certificate renewal dry-run also passed, with a per-certificate graceful Nginx reload hook configured.
