import assert from "node:assert/strict";
import test from "node:test";
import { auditKeyAccess, auditRequestSchema } from "../src/access_policy.js";

test("a key reaches a record only when it carries every required scope", () => {
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

  const [review] = auditKeyAccess(input, [{
    id: "key-7",
    name: "maintenance dashboard",
    scopes: ["maintenance:read", "tenants:read", "inspections:read"],
  }]);

  assert.deepEqual(review.reachable, {
    maintenanceRequests: ["repair-104"],
    tenantDocuments: [],
    inspectionReminders: ["inspection-8"],
  });
});
