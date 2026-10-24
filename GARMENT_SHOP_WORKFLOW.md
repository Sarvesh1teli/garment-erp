# Garment shop and school workflow

Existing installations default to **Both**. Choose Garment Shop, School Uniform Business, or Both in Settings → Garment Details → Business type. This setting changes the visible workflow; it does not delete schools, measurements, inventory, invoices, payments, or delivery records.

## Daily use

- Inventory → Materials: material balances, receipts, issues to production, and item heads.
- Inventory → Ready Garments: one stock list and Add Stock form for General Stock, School, or Customer. General Stock uses the original Common Stock records and balances; no migration or duplicate receipts are created.
- Inventory → Stock Movements: read-only sale, reservation, and return history.
- Inventory → Existing Screens: original inventory, barcode, and allocation screens remain available. Creating a sale from an old stock-issue screen routes to Sales & Billing.
- Sales & Billing → Quick Sale & Returns: multi-item bills, optional walk-in name/phone, full Cash/UPI/Bank payment or pay later, optional tax, Save or Save & Print.
- Deliver now: records one outgoing movement.
- Deliver later: reserves available stock without decreasing physical on-hand quantity. Delivery → Dispatch Bills releases that reservation and records the dispatch once, without creating another invoice.
- Full Return / Cancel bill: retains the original bill, creates a credit note, restores dispatched goods or releases the reservation, and records the collected amount as refunded. Only full-bill returns are supported in this flow.
- Manual challans remain delivery paperwork. They do not create bills or independently deduct stock.

## Existing invoices and school records

Existing invoices and payments remain in their original stores. An invoice without an existing stock issue can be selected in Quick Sale to link matching garments, sizes, quantities and prices to dispatch. Linking reuses the original invoice and retains its payments. Already-issued invoices cannot be dispatched again through this flow.

Existing school delivery buttons open Quick Sale for that school. School ordering, measurement quantities, production summaries, barcodes, and school connections remain available in Both / School Uniform Business mode.

General / Customer Production records work requirements and completed quantities without requiring a school. Completion does not invent inventory receipts: receive the finished garments separately through Inventory → Ready Garments → Add Stock.

## Data compatibility

New sales are stored under `garment-retail-ledger` as a complete bill/payment/stock-operation record. Existing screens read projections of those records; their ordinary updates do not duplicate those projections into legacy invoice/payment/stock stores. Managed bills and initial receipts are changed through sale returns/cancellations instead of deleting their stock history.

Unsynced ledger writes are retained in tenant-scoped local storage and retried when the connection returns. Ledger writes are serialized; a stale backend response cannot replace a newer local sale. Existing legacy store keys and stock receipt formats remain unchanged.

No school PWA, shared server, unrelated application, or Firebase configuration changes are required for this desktop release.
