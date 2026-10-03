import { auditRequestSchema } from "../src/access_policy.js";
import { InfraiClient } from "../src/infrai_client.js";
import { runPropertyAudit } from "../src/property_audit_service.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("INFRAI_API_KEY is required");

const input = auditRequestSchema.parse({
  propertyName: "Juniper Court",
  maintenanceRequests: [
    { id: "repair-104", title: "Replace hallway light", requiredScopes: ["maintenance:read"] },
  ],
  tenantDocuments: [
    { id: "lease-22", title: "Apartment 22 lease", requiredScopes: ["tenants:read", "documents:read"] },
  ],
  inspectionReminders: [
    { id: "inspection-8", title: "Annual fire inspection", requiredScopes: ["inspections:read"] },
  ],
});

const result = await runPropertyAudit(input, new InfraiClient(apiKey));
console.log(JSON.stringify(result, null, 2));
