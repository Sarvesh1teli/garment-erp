# ThreadFlow — Garment Production & Tailoring ERP

Desktop-first ERP starter for garment factories, tailoring shops, and school-uniform suppliers.

Application data is persisted by a local HTTP API in SQLite. The renderer does not use browser `localStorage` for business data.

## Local API

Phase 2 provides normalized SQLite tables and dedicated collection endpoints for the first master-data modules:

- `GET` / `PUT` `/api/customers`
- `GET` / `PUT` `/api/schools`
- `GET` / `PUT` `/api/students`
- `GET` / `PUT` `/api/employees`
- `GET` / `PUT` `/api/work-types`
- `GET` / `PUT` `/api/assignments`
- `GET` / `PUT` `/api/work-entries`
- `GET` / `PUT` `/api/advances`
- `GET` / `PUT` `/api/salary-payments`
- `GET` / `PUT` `/api/inventory-items`
- `GET` / `PUT` `/api/stock-receipts`
- `GET` / `PUT` `/api/stock-issues`
- `GET` / `PUT` `/api/expense-vendors`
- `GET` / `PUT` `/api/expense-categories`
- `GET` / `PUT` `/api/expenses`
- `GET` / `PUT` `/api/company-settings`
- `GET` / `PUT` `/api/module-settings`
- `GET` / `PUT` `/api/school-collections`
- `GET` / `PUT` `/api/invoices`
- `GET` / `PUT` `/api/invoice-payments`
- `GET` / `PUT` `/api/delivery-challans`
- `POST` `/api/media`
- `GET` / `DELETE` `/api/media/{id}`
- `GET` / `POST` `/api/backups`
- `POST` `/api/backups/{id}/restore`

Older Phase 1 records migrate automatically from `app_state` on first access. Remaining modules continue through `/api/state/{resource-key}` until their domain migration phase.

School logos and boys/girls dress photos are validated as JPEG, PNG, or WebP (maximum 10 MB), stored under `assets/schools/{school-id}/`, and referenced from SQLite through `media_assets`. The files are no longer temporary browser object URLs.

Backups are stored under the application-data `backups/{backup-id}/` directory. Each package contains a consistent `threadflow.db` snapshot, the complete `assets` tree, and a versioned `manifest.json`. Restore validates database integrity and package structure before replacing data and images. Backup and restore controls are available in Settings.

Invoices persist complete billing, shipping, GST, product, tax, terms, status, paid, and balance information. Invoice payments support partial/full settlement and printable receipts. Delivery challans persist customer, transport, product, quantity, status, and acknowledgement details. Restore maps common columns so backups created before later schema expansions remain compatible.

## Desktop startup

On a first installation, the app opens subscription activation and creates the first Owner login. An expired installation opens renewal. Every active application launch opens the login page before loading ERP data. Passwords are stored as salted scrypt hashes. Current subscription details and renewal controls are available under Settings → Subscription.

## Windows installer

Generate the customer installer with `npm run desktop:installer`. The NSIS setup is written to `release/Teli ThreadFlow Setup <version>.exe`, supports a selectable installation directory, creates desktop and Start Menu shortcuts, and preserves application data during uninstall/reinstall. Use `npm run desktop:unpacked` for an unpacked test build. ThreadFlow is single-instance and stores customer data outside the installation directory.

## Run

```powershell
npm install
npm run desktop:dev
```

For browser-only development, `npm run dev` starts both the local API and Vite. The default API is `http://127.0.0.1:47831`; set `VITE_API_BASE_URL` when connecting the same frontend to a hosted backend.

Desktop data is stored under Electron's per-user application-data directory. Browser development uses `.local-data/database/threadflow.db`.

## Included MVP shell

- Role-aware module navigation
- Production dashboard and stage tracking
- Customers, schools, and measurements
- Cutting, stitching, QC, ironing, packing, and delivery
- Attendance, work assignment, wages, inventory, billing, expenses, and reports

The UI and Electron shell are separated so the local SQLite API can later be replaced or synchronized with a Spring Boot/PostgreSQL API for the cloud edition.
