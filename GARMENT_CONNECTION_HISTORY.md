# School and garment connection history

- Desktop: **School Orders → Connection History**.
- School PWA: **Profile → Connection History**.
- Both views provide From/To dates, status filters, Refresh, and five events per page.
- Each garment business can read only its own school relationships. Each school can read only its own supplier relationships.

## What is recorded

The dedicated school-order service records connection requests, approval, rejection (including its reason), disconnection and reconnection in `garment_connection_history`. A PostgreSQL trigger inserts an event in the same transaction as a link status change. Reconnecting reuses the relationship but adds new events rather than overwriting its history. Names and connection codes are captured at event time.

Existing relationships are imported once as **Recorded state**, using the existing record timestamp. Earlier transitions were not tracked and cannot be reconstructed reliably. These baseline records are deliberately distinguished from newly recorded events.

A school must disconnect an approved or pending supplier before requesting another connection. Pending requests can be cancelled from the school Profile. Concurrent requests from the same school are serialized with a school-row lock. Connection changes do not reassign existing orders. The separately confirmed legacy shared-connection order transfer remains a separate operation.

## Deployment and checks

This is implemented for the deployed supplier-model service, `server/school-order-server.js`, with its `server/connection-history.cjs` module. The separate tenant-model `server/index.js` is not changed by this feature.

The garment database and runtime were backed up before deployment. Only `school-uniform-order` was restarted. The school PWA is deployed at `https://garment.telisoftware.com/school-orders/`. Install the rebuilt desktop installer to enable its new history endpoint.

Validation passed: TypeScript and production builds; local history API scope/filter/pagination tests; existing identity and notification tests; live temporary school/business tests covering approval, rejection, disconnection, reconnection, duplicate requests, one active connection, five-row pagination, reasons, invalid dates, isolation, and preservation of original order ownership after switching suppliers. Temporary test accounts, links, events and orders were removed.
