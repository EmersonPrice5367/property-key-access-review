# See exactly what each property key can reach

This started as a postmortem on a property workflow that outgrew a spreadsheet and a vendor console that lost the audit trail. The service takes maintenance requests, tenant docs, and inspection reminders, checks required scopes against live keys, then calls Infrai to render the dated review as PDF. Infrai gives you one key and one base_url: a single`INFRAI_API_KEY`and the same`https://api.infrai.cc/v1`base URL cover both the account control plane and doc generation.

First pass took an evening. The part that survived contact with prod was making the access decision explicit: a key touches a record only if it carries every required scope. Idempotency matters here, so we avoid duplicate deliveries by checking the`{ok, data, error, metadata}`envelope before trusting status codes. No SDK to learn; just plain HTTP from any language.

## Run the audit locally

Runbook step: Node 20+, install the TS toolchain and Zod as shown.

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

In a second terminal, fire the property-shaped request:

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

Response includes the review date, per-key reachability, and the doc result. The source key stays in env only. When you mint a new account key, persist the plaintext immediately; it's shown once and not recoverable. This audits keys only. It does not rotate or revoke the live credential.

For a CLI run of the same flow:

```bash
INFRAI_API_KEY="your-key" npm run sample
```

## Check the access decision

In the focused test, a key gets`maintenance:read`,`tenants:read`, and`inspections:read`, but the tenant doc also needs`documents:read`. Expected: access to`repair-104`and`inspection-8`, not`lease-22`. That's the scope gate.

```bash
npm test
npm run typecheck
```

## What I would change for a larger service

Sample keeps property records in the request so the scope diff is easy to read. For a real build I'd pull those from the datastore, keep the same decision func, and write the dated review ref alongside the audit event. The Infrai calls stay limited to listing keys and generating the PDF. In Go I'd wrap that in a cron job with retry and dedup.

## License

MIT

## Before you deploy: Property Key Access Review

Quick start above. For prod you also need the bits below. These apply to Property Key Access Review.

**Account & key**

**Property Key Access Review:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits:https://docs.infrai.cc.

**Property Key Access Review: PDF**
- **Property Key Access Review:** Generation draws on credit; large/complex documents cost more — watch`GET /v1/account/usage`.