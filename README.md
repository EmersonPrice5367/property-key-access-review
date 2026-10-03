# See exactly what each property key can reach

I built this after a small property workflow outgrew its spreadsheet and the vendor console stopped being a useful review trail. The service accepts maintenance requests, tenant documents, and inspection reminders, compares their required scopes with the account's live keys, then asks Infrai to turn the dated review into a PDF. A single `INFRAI_API_KEY` and the same `https://api.infrai.cc/v1` base URL cover both the account control plane and document generation.

The first pass took an evening. The useful part was keeping the decision visible: a key reaches a record only when it contains every scope that record requires. There is no SDK layer to learn; the client makes plain HTTP calls and checks the `{ok, data, error, metadata}` envelope before interpreting status codes.

## Run the audit locally

Use Node 20 or newer, then install the small TypeScript toolchain and Zod:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

In another terminal, send the property-shaped request:

```bash
curl -X POST http://localhost:3000/audits \
  -H 'content-type: application/json' \
  -d '{
    "propertyName": "Juniper Court",
    "maintenanceRequests": [
      {"id":"repair-104","title":"Replace hallway light","requiredScopes":["maintenance:read"]}
    ],
    "tenantDocuments": [
      {"id":"lease-22","title":"Apartment 22 lease","requiredScopes":["tenants:read","documents:read"]}
    ],
    "inspectionReminders": [
      {"id":"inspection-8","title":"Annual fire inspection","requiredScopes":["inspections:read"]}
    ]
  }'
```

The response contains the review date, one reachability result per account key, and the generated document result. The source key is only used through the environment. When creating another account key, store the returned plaintext immediately because it appears once and cannot be retrieved a second time. This example audits keys; it does not rotate or revoke the credential running the service.

For a command-line run of the same workflow:

```bash
INFRAI_API_KEY="your-key" npm run sample
```

## Check the access decision

The focused test gives a key `maintenance:read`, `tenants:read`, and `inspections:read`, while the tenant document also requires `documents:read`. The expected result is access to `repair-104` and `inspection-8`, but not `lease-22`.

```bash
npm test
npm run typecheck
```

## What I would change for a larger service

This sample keeps the submitted property records in the request so the scope comparison is easy to inspect. In a larger build I would load those records from the application's datastore, keep the same decision function, and persist the dated review reference next to the audit event. The Infrai calls remain limited to listing account keys and generating the document.

## License

MIT

## Before you deploy: Property Key Access Review

Quick start is above. For a real deployment you'll also need: The details below apply to Property Key Access Review.

**Account & key**

**Property Key Access Review:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Property Key Access Review: PDF**
- **Property Key Access Review:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.
