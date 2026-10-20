# School Uniform Order — Project Context

Last updated: 03 October 2026

## Purpose

ThreadFlow consists of two separate applications that exchange school uniform orders:

1. **ThreadFlow Garment ERP** — a desktop application installed and run locally on the garment supplier's/customer's computer.
2. **School Uniform Order** — a cloud-hosted PWA used by schools to create orders and track their permanent order history.

The cloud deployment must contain only the School Uniform Order PWA and its API. Do not deploy or expose the full Garment ERP dashboard in the cloud.

## Application flow

1. The Garment ERP generates a unique garment connection ID.
2. A school registers or signs in to the School Uniform Order PWA.
3. The school enters the garment supplier's connection ID and sends a connection request.
4. The garment supplier approves or rejects the school connection in the desktop app.
5. An approved school creates and submits uniform orders.
6. The garment supplier reviews each submitted order and accepts or rejects it.
7. Both applications retain the order, status, supplier response, and history.

The school is automatically selected from the signed-in school account. Users must not manually choose another school while creating an order.

## School PWA requirements

- Application name: **School Uniform Order**.
- Must be installable and usable as a PWA.
- Keep the interface simple, mobile-friendly, and based on module cards rather than the full ERP sidebar.
- Main modules include Create Order, Order History, Submitted, Accepted, Rejected, and Supplier/Profile.
- Orders contain order date, optional required date, notes, and one or more garment rows with garment type, size, and quantity.
- Maintain permanent garment order history.
- Order History must use a compact row-wise table.
- Each history row must have a **View** action.
- View must show complete order details: dates, status, all garment rows, total quantities, school notes, garment acknowledgement or rejection reason, and the complete status timeline.
- History must support search, status filtering, and pagination. Current page-size choices are 5, 10, and 20 rows.

## Garment desktop requirements

- The desktop Garment ERP runs only on the local/customer machine.
- The School Orders screen displays the garment connection ID and supports copying it.
- Do not display the redundant top heading `School Orders` or the text `Receive, review and acknowledge school uniform orders.`
- School orders appear in a row-wise table with school, dates, summarized item details, total quantity, status, and View action.
- View shows the complete submitted order.
- Accept and Reject require confirmation before changing the order.
- Reject requires a rejection reason. Accept may include an acknowledgement message.
- Accepted and rejected orders remain visible as permanent history.

## Current deployment

- Public URL: `https://garment.telisoftware.com/school-orders/`
- Dedicated API/service port: `18081`
- Dedicated systemd service: `school-uniform-order.service`
- Cloud application directory: `/tmp/ubuntu/garment`
- Cloud database/schema: `threadflow_school_orders`
- Current garment connection ID: `TFG-54C8-B79D`
- Server: `ubuntu@150.136.166.77`
- Local SSH key: `C:\Users\Lenovo\Desktop\oracle_key\sridher\ssh-key-2026-09-23.key`

Do not modify, stop, replace, or redeploy other applications already running on the server. Restart only `school-uniform-order.service` for this PWA.

## Relevant source files

- `src/SchoolUniformOrderApp.tsx` — school-facing PWA screens and behaviour.
- `src/school-main.tsx` — school PWA entry point.
- `src/modules/network/SchoolOrdersPage.tsx` — garment desktop School Orders screen.
- `src/styles.css` — shared and school-order interface styles.
- `server/school-order-server.js` — dedicated cloud API/server.
- `vite.school.config.ts` — dedicated school PWA build configuration.
- `school-index.html` — school PWA HTML entry.
- `public/school-uniform-order.webmanifest` — PWA manifest.

## Build and deployment workflow

Desktop verification:

```powershell
npm run build
```

School-only PWA build:

```powershell
npx vite build --config vite.school.config.ts
```

The school build output is `dist-school`. Package and deploy only the school build and dedicated school-order server files. After deployment, restart only `school-uniform-order.service`, confirm that it is active, and verify the public URL returns HTTP 200.

## Latest completed work

- Removed the redundant School Orders heading and description from the desktop screen.
- Converted the School PWA Order History from expanded cards to a row-wise table.
- Added a complete-details View dialog.
- Added page-size selection and Previous/Next pagination.
- Replaced native browser Accept/Reject prompts with a styled in-app confirmation dialog. It shows the order, school, quantity, acknowledgement/rejection input, validation, progress, error, and success feedback; accepted or rejected status refreshes immediately.
- Order actions now time out after 15 seconds, can be cancelled while processing, and display connection errors inside the dialog. School-order overlays no longer cover the desktop sidebar, so Staff Management and other modules remain accessible even if a cloud request stalls.
- The School & Supplier page now provides **Disconnect & Connect Again** for approved connections. It uses a confirmation dialog, preserves all existing orders/history, changes only the active supplier link to `DISCONNECTED`, and then restores the connection-ID form.
- Expired or invalid school login tokens must return HTTP 401 without terminating the API process. The PWA clears an expired local session and returns the user to School Login with a sign-in-again message; this prevents expired sessions from causing an Nginx 502.
- Verified both desktop and school PWA production builds.
- Deployed the school-only package and verified the live URL.

## Guardrails for future changes

- Preserve the separation between local Garment ERP and cloud School Uniform Order PWA.
- Never deploy the full desktop ERP to the school URL.
- Never reuse the school service port for another application.
- Preserve existing school orders, history, connections, and database data during deployments.
- Test important buttons and API error handling before deployment.
- Keep tables compact, readable, and responsive without exposing page-level horizontal scrolling in print layouts.
