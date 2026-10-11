# Implementation prompt: Teli desktop registration, subscriptions, and updates

## Role and objective

Act as a senior full-stack developer. Build a separate cloud administration project for Teli Software's Garment and Billing desktop apps, and add a small cloud connection module inside each desktop app.

The owner needs to know how many customers use each app, when subscriptions expire, which software version each computer runs, and whether customers installed a published update.

This document is an implementation specification. Inspect the existing repositories and infrastructure before changing them. Reuse suitable existing authentication and hosting where available. Do not assume access to the School ERP API or modify that project without authorization.

## Scope: metadata only

The cloud stores customer registration, subscriptions, installations, check-ins, release information, and update notification events.

Invoices, stock, salaries, school/student records, accounting transactions, and all other business records remain in the desktop app's existing local database. Do not add business-data synchronization, uploads, or cloud backup as part of this project.

No credentials from screenshots or conversations may be copied into source code, seed data, documentation examples, or logs. All examples below use placeholders.

## Project structure and technology

- Separate cloud admin web app: React, TypeScript, and Vite.
- Backend API: Node.js and TypeScript; choose a maintained HTTP framework after inspecting the environment.
- Cloud database: PostgreSQL with versioned migrations.
- Admin authentication: reuse a suitable managed authentication provider or existing secure admin authentication.
- Deployment: HTTPS admin website and HTTPS backend, with secrets configured through the hosting environment.
- Desktop integration: a small module in each existing app, preserving the current offline database and workflows.
- Installer storage for the first phase: Google Drive links entered by the administrator.

Suggested layout:

```text
teli-cloud-admin/            # Separate project
  admin-web/
  api/
  database/
  docs/

garment-erp/                 # Existing app
  electron/                 # Credentials, network calls, activation integration
  src/                      # Cloud connection settings and notifications

billing-app/                # Existing app; inspect its stack before implementation
  ...                       # Equivalent integration for its platform
```

The existing Garment project uses React/TypeScript/Vite and Electron, with Windows NSIS packaging. Its current installer command is `npm run desktop:installer`. Inspect current files before relying on this context. Billing's platform has not been confirmed; do not assume it is Electron.

Desktop apps call the API over HTTPS. They never receive PostgreSQL credentials or connect directly to the database.

## Core identity model

A customer is a business, not a computer. A customer may subscribe to Garment, Billing, or both. A customer can have multiple registered computers, subject to an administrator-configured device limit.

Each desktop installation is registered once and gets its own installation ID and credentials. Updates preserve that registration. Garment and Billing installations are distinct, even when installed on the same computer.

Use these stable app identifiers:

- `garment`
- `billing`

Suggested registration payload returned by the server:

```json
{
  "customerId": "<customer-uuid>",
  "customerCode": "GAR001",
  "appId": "garment",
  "installationId": "<installation-uuid>",
  "installationKey": "INST-<generated-public-identifier>",
  "installationToken": "<secret-issued-by-server>"
}
```

`installationKey` is a display identifier, not a secret or authentication mechanism. `installationToken` is secret and is scoped to one installation and app.

## Registration and activation flow

1. Administrator creates a customer with business name and contact details.
2. Administrator adds a subscription for the selected app, including start and expiry dates and allowed installation count.
3. Administrator generates a short-lived, limited-use activation code for that customer and app.
4. Customer enters the Cloud API URL and activation code in the desktop app.
5. API validates the activation code, subscription, and device limit, then creates an installation and issues credentials.
6. Desktop saves the credentials securely and displays the connected customer, subscription, and installation details.
7. Subsequent launches reuse the saved credentials; the user does not register again after an ordinary app update.

Activation requests must support retry without accidentally consuming two device slots or creating duplicate registrations. Reinstallation or a replacement computer needs an explicit deactivate/rebind process; do not silently create unlimited installations.

Provide an optional manual credentials configuration/import flow for administrator-assisted setup, equivalent to the School ERP reference. Validate that pasted credentials belong to the current app and installation before saving them.

## Desktop settings: reference screenshot adaptation

Add a Settings section named **Cloud Registration & Updates**. Follow the reference's grouped fields and masked token input, adapting school terminology to business terminology.

| Field | Behavior |
|---|---|
| Cloud API URL | HTTPS endpoint; default supplied through deployment configuration |
| Customer Code | Business code, such as GAR001 or BIL001 |
| Cloud Customer ID | Customer UUID |
| Installation ID | Registered installation UUID |
| Installation Key | Public installation identifier, read-only after registration |
| Installation Token | Password-style field; never prefill the saved token into the renderer |
| Cloud Connection | Enabled/Disabled toggle; do not label it Business Data Sync |
| Installed Version | Read from the actual installed app/package |
| Connection Status | Not registered, Connected, Offline, Invalid credentials, or Disabled |
| Last Successful Check-in | Timestamp of the last successful server contact |
| Subscription | Active, Expiring soon, Expired, or Not configured; display expiry and days remaining |

Actions: **Activate**, **Save**, **Test Connection**, and **Check for Updates**. Manual credentials import may be offered in an advanced section.

Token UX:

- If configured, show the placeholder `Token already configured`.
- Show helper text: `Leave blank to keep the currently saved token.`
- Saving an empty token must preserve the saved token.
- Reveal may show only a newly typed token; do not return the saved secret to the renderer to support reveal.
- Replace or remove credentials through an explicit action, not by accidentally submitting an empty field.
- For Electron, use OS-backed secret storage where available and a narrowly scoped main/preload IPC interface. If secure storage is unavailable, document a safe fallback rather than silently storing plaintext.

Show this clear explanation in settings: `Only registration, subscription, installed version, and connection status are shared. Your business records remain on this computer.`

Disabling the connection stops background check-ins and update checks and shows that subscription information may be stale. It does not change the subscription recorded by the server. If offline subscription enforcement is later required, define its policy explicitly rather than allowing this toggle to bypass it.

## Admin portal pages

### Dashboard

Summary boxes: registered customers, registered installations, recently connected customers, active subscriptions, expiring soon, expired subscriptions, updated installations, and update pending.

Count customers and installations separately. Define recently connected as a configurable window, initially the last 30 days. Last check-in indicates recent contact, not continuous usage or whether a computer is currently running.

### Customers

Fields: customer code, business name, owner/contact name, phone, optional email, location, registration date, subscribed apps, and active/disabled status.

Search and filter by business, app, customer status, and subscription status. Detail view shows subscriptions, installations, and renewal history.

### Subscriptions

Store subscriptions per customer and app. Display start date, expiry date, days remaining, status, allowed installation count, last renewal date, and optional payment reference/amount for the software subscription only.

Renewals retain history rather than overwriting past renewals. Define date boundaries and timezone explicitly; for the initial deployment use Asia/Kolkata, inclusive expiry through the end of the selected day, and UTC timestamps internally.

Show reminders at 30, 7, and 1 day before expiry. Prevent repeated popups on every check-in. Proposed first-phase behavior is reminders only: expiry must not abruptly lock users out or delete data. Any future grace period or restrictions need an approved policy, with access to records and backup/export preserved.

### Desktop Updates / Releases

Publish each app separately. Release fields:

- App: Garment or Billing.
- Semantic version, for example `1.0.8`.
- Release title and notes.
- Google Drive installer URL.
- Optional installer size and SHA-256 checksum.
- Draft/Published/Withdrawn state.
- Published timestamp and administrator.

Provide **Save Draft**, **Save and Publish**, and **Withdraw**. Validate the link and version; prevent duplicate versions within the same app. Use semantic comparison, so `1.0.10` is newer than `1.0.9`.

Only published releases appear to desktop clients. Withdrawn releases stop being offered. An older release must not trigger an automatic downgrade.

### Installation Status

Replicate the useful behavior of the reference screenshot, using businesses instead of schools.

Columns:

| Business / Customer Code | App | Installation Key | Installed Version | Latest Published Version | Update Status | Download Clicked | Last Check-in | Subscription Expiry | Installation Status |
|---|---|---|---|---|---|---|---|---|---|

Update statuses:

- **Unknown:** no installed version has been reported.
- **Update available:** installed version is older than the relevant release.
- **Download clicked:** the user opened the link; installation is not confirmed.
- **Updated:** a later authenticated check-in reports the target version or a newer version.

Keep update status separate from installation Active/Disabled and connection freshness. A customer can download but remain on the old version; clicking Download must never mark them Updated.

Track events per release and installation, so clicking an earlier release does not mark a newly published release as downloaded. Provide filters for app, business, installed version, update status, subscription status, and recent connection.

### Audit Log

Record customer edits, subscription renewals, activation creation, installation disable/re-enable, token rotation, and release publishing/withdrawal. Include administrator and time. Never log secrets.

## Desktop update notification flow

1. Administrator builds the installer using a new package version.
2. Administrator uploads the `.exe` to Google Drive and configures sharing so intended customers can download it.
3. Administrator publishes the app/version/link in the portal.
4. Desktop checks on startup and at a configurable interval, initially every six hours while online, with jitter and exponential retry backoff on failures.
5. Older installations show a popup similar to the reference:

```text
New Garment version available
Version: 1.0.8
Currently installed: 1.0.6
Release notes: ...

[Remind later] [Download update]
```

6. Remind later defers the popup for a configurable period, initially 24 hours. Keep a passive update indicator available.
7. Download update opens the approved installer link in the browser and reports a best-effort download-click event. The tracking call must not block opening the link if the server is unavailable.
8. After the user installs and relaunches, the desktop reports its actual version; the portal then confirms Updated.

First phase uses automatic notification and user-clicked download, not silent downloading or automatic installation. Ordinary Google Drive share links are browser download destinations, not an Electron auto-update feed. Full automatic installation is a future phase using supported release hosting, updater metadata, and appropriate installer signing.

Offline installations receive updates at their next successful check-in. Publishing cannot instantly reach closed or disconnected applications. App-specific releases must never show Garment installers to Billing customers or vice versa.

## Suggested cloud database entities

- `customers`: ID, unique customer code, business/contact fields, status, created/updated timestamps.
- `apps`: stable app ID and display name.
- `subscriptions`: customer ID, app ID, start/expiry dates, status, device limit; unique current subscription per customer/app.
- `subscription_renewals`: subscription ID, prior/new dates, renewal date, optional subscription payment reference/amount, administrator.
- `activation_codes`: hashed code, customer/app, expiry, allowed uses, consumed count.
- `installations`: ID, customer/app, public installation key, token hash, device label, status, installed version, last check-in, registration timestamp.
- `releases`: ID, app, unique app/version, notes, installer URL, optional checksum/size, state, published timestamp.
- `installation_release_events`: installation/release, event type, timestamp; support idempotent retries.
- `admin_users` or managed-auth role mapping.
- `audit_logs`: actor, action, entity, safe details, timestamp.

Avoid unnecessary device fingerprints or hardware identifiers. A generated installation identity and optional device label are sufficient for the initial scope.

## Suggested API contract

Use a versioned API and installation-scoped authentication. Endpoint names may be adapted to existing conventions.

```text
POST /api/v1/desktop/activate
POST /api/v1/desktop/check-in
GET  /api/v1/desktop/status
POST /api/v1/desktop/release-events

GET/POST/PATCH /api/v1/admin/customers
GET/POST/PATCH /api/v1/admin/subscriptions
POST          /api/v1/admin/subscriptions/:id/renew
POST          /api/v1/admin/activation-codes
GET/PATCH     /api/v1/admin/installations
POST          /api/v1/admin/installations/:id/rotate-token
GET/POST/PATCH /api/v1/admin/releases
POST          /api/v1/admin/releases/:id/publish
POST          /api/v1/admin/releases/:id/withdraw
GET           /api/v1/admin/audit-logs
```

Example check-in request, authenticated with the installation token:

```json
{
  "installationId": "<installation-uuid>",
  "appId": "garment",
  "installedVersion": "1.0.6"
}
```

Example response:

```json
{
  "serverTime": "<UTC timestamp>",
  "customer": { "code": "GAR001", "name": "Example Garments" },
  "installationStatus": "active",
  "subscription": {
    "status": "active",
    "expiresOn": "2027-03-31",
    "daysRemaining": 120
  },
  "latestRelease": {
    "id": "<release-uuid>",
    "appId": "garment",
    "version": "1.0.8",
    "downloadUrl": "https://drive.google.com/<installer-link>",
    "notes": "Example release notes"
  }
}
```

Example values are illustrative, not computed dates. Return `latestRelease: null` when none is published. Server derives customer/app authorization from the token and checks it against supplied IDs; never trust client IDs alone. Compute subscription status server-side. Cache the last successful response locally with its timestamp and label stale information clearly.

## Security and reliability requirements

- Distinct admin and installation permissions; installation tokens cannot call admin endpoints or access other customers.
- Hash high-entropy installation tokens on the server; show a newly issued token only once, with rotation/revocation available.
- Rate-limit activation and authentication failures, validate inputs, and redact credentials from logs.
- Keep secrets out of React bundles, URLs, analytics, and exports.
- Restrict installer URLs to HTTPS and configured trusted hosts; reject executable script schemes and unsafe links.
- Perform Electron credential handling/network integration through the main process with limited preload APIs; inspect the existing security model.
- Network checks must not freeze the UI or block normal offline work. Use timeouts, retries, and a single background scheduler.
- Server downtime must not be treated as expired subscription, disabled installation, or confirmed absence of an update.
- Use database backups, migrations, and auditable renewal/release operations.

## Acceptance criteria

1. Register one customer with Garment and Billing subscriptions; installations remain isolated by app.
2. Register two computers for one customer; dashboard counts one customer and two installations.
3. Device limits, expired activation codes, retries, and wrong-app credentials are handled correctly.
4. Normal app upgrades preserve credentials and business records without another registration.
5. A subscription renewal updates connected installations on their next successful check-in and retains renewal history.
6. Publishing Garment `1.0.8` notifies an online Garment `1.0.6` installation; Billing is unaffected.
7. A download click does not mark installation Updated. A subsequent version report does.
8. Publishing a newer release resets the relevant pending/download state for that release.
9. Semantic versions, unknown versions, no published release, and withdrawn releases behave correctly.
10. Offline use and API outages preserve business workflows; reconnection refreshes metadata.
11. Saving blank token preserves credentials; invalid/revoked tokens show an actionable status without exposing secrets.
12. No business records are present in cloud requests, logs, or database tables.
13. Filters, summary counts, subscription date boundaries, and installation status are consistent.
14. The Windows installer is built successfully and includes the registration/update integration.

## Delivery plan

1. Inspect repositories, authentication, API hosting, and desktop packaging. Report concrete dependencies or missing access.
2. Build the separate cloud database/API and admin pages with migrations and setup documentation.
3. Integrate registration settings, activation, secure credential storage, check-ins, and expiry reminders into Garment.
4. Integrate equivalent behavior into Billing after inspecting its repository/platform.
5. Add app-specific releases, popups, download-event reporting, and installation monitoring.
6. Validate end-to-end using test customers/installations and build desktop installers.

Deliver source code, migrations, environment-variable examples without secrets, deployment instructions, API documentation, and validation results. Document any unimplemented dependency clearly. Do not publish releases, provision paid services, or deploy to production merely because this specification describes those features.
