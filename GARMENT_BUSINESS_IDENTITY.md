# Separate garment business identities

The School Orders connection code is no longer based on the local login username or the `default` tenant. Local invoices, stock, salary, and login behavior are unchanged.

## Fresh installations

On first use of School Orders, Electron generates a random business UUID, a 256-bit private credential, and an installation UUID on that computer. The private identity is encrypted using Windows secure storage and saved in the app's user-data directory. It is not generated during the build, included in the installer, returned to the renderer, or inferred from `admin`.

The server verifies the private credential before returning school connections or orders. It stores only the credential hash. Business identities and public connection codes persist through app updates, restarts, and local account changes. Different fresh installations start as separate businesses, even if both use the local admin login.

## Two computers in one business

On the existing business computer, open School Orders and select **Link another computer: Export**. Save the private business link file securely. On the second computer, use **Use existing business: Import** and select that file. Both computers then share the business connection code, with separate installation IDs.

The file is a credential, not just a public connection code. Share it only with your own business computers. Import requires confirmation, validates the business against the server before replacing the local identity, and keeps an encrypted recovery copy of any previous identity. It does not transfer or merge local invoices/stock. Store an export securely for a future reinstall or replacement computer. Copying a whole app-data profile or deliberately importing the same private link file means using the same business; installing the same .exe on fresh computers does not.

School Orders cloud operations require the updated Electron app. An ordinary browser does not receive a private desktop identity or fall back to the shared default identity.

## Existing shared connection migration

The old unauthenticated supplier records are retired (disabled), and their pending/approved school links become Disconnected. Historical orders, items, timeline, and school notification history remain stored. No historical orders are automatically assigned to the first new installation.

1. Install the updated desktop and open School Orders to obtain the new business connection ID.
2. In the school PWA, open Profile and enter the correct supplier's new code.
3. Approve the school request from that garment business's desktop.
4. The school may explicitly choose **Confirm historical order transfer**. This transfers only that authenticated school's orders from retired shared identities to its currently approved private garment business. The action adds an audit timeline event; it cannot transfer orders from another active private business.

Schools can still view their existing historical orders before transfer. New orders go only to an approved, enabled private garment business. Old desktop versions using only `X-Tenant-ID: default` are rejected and must be updated.

## Server scope

The deployed Uniform Order service is `server/school-order-server.js`, using `server/garment-identity.cjs`. The separate tenant-authenticated SaaS server in `server/index.js` is not converted to this desktop registration protocol. Do not point this desktop registration flow at another server/application.

The additive schema includes a credential hash on garment_suppliers and garment_desktop_installations. Credentials are never stored in the school PWA. The public connection code lets a school request a connection; it is not sufficient to read or act on the supplier's orders.

Checks: `node tests/garment-identity.test.cjs`, `node tests/garment-cloud.test.cjs`, existing notification tests, TypeScript and desktop/PWA builds. The live migration must be backed up and verified only against the garment service/database.

## Deployed verification — 17 October 2026

The private-identity update was deployed only to school-uniform-order under /tmp/ubuntu/garment, backed up at /tmp/ubuntu/garment/.identity-backup-20261017-a. Other applications and shared proxy settings were not changed.

Live temporary-business tests passed: unique codes, stable second-computer identity, rejection of default and forged headers, cross-business order/link isolation, and explicit authenticated school transfer of a legacy fixture order. Temporary records were removed. All 7 pre-existing garment orders remained unchanged. The retired shared business remains disabled; schools must reconnect using a new business code after the desktop update.
# Garment display name synchronization

Saving **Settings → Garment Details** in the updated desktop app publishes the trimmed garment name through authenticated `POST /api/garment/profile`. Only that business's display name changes; its connection code, school links and orders remain unchanged. The desktop keeps a pending name in its encrypted identity file when offline and retries every minute. A linked computer publishes its name only when the user saves settings, so polling cannot overwrite a newer name with stale local settings.

The school PWA refreshes its connected supplier profile on focus and every 30 seconds while visible. Install the rebuilt desktop installer, save the correct garment name once, and reopen the school PWA. The school must be connected to that same garment business.

Verified using isolated live garment test businesses: rename persisted, connection codes stayed stable, the second business remained unchanged, and forged credentials were rejected. Temporary test records were removed. Only the garment service was restarted.

