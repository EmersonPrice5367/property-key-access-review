import { z } from "zod";

const protectedRecordSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  requiredScopes: z.array(z.string().min(1)).min(1),
});

export const auditRequestSchema = z.object({
  propertyName: z.string().min(1),
  maintenanceRequests: z.array(protectedRecordSchema),
  tenantDocuments: z.array(protectedRecordSchema),
  inspectionReminders: z.array(protectedRecordSchema),
});

export type AuditRequest = z.infer<typeof auditRequestSchema>;

export type AccountKey = {
  id: string;
  name: string;
  scopes: string[];
};

export type AccessReview = {
  keyId: string;
  keyName: string;
  scopes: string[];
  reachable: {
    maintenanceRequests: string[];
    tenantDocuments: string[];
    inspectionReminders: string[];
  };
};

function reachableIds(records: AuditRequest["maintenanceRequests"], scopes: Set<string>): string[] {
  return records
    .filter((record) => record.requiredScopes.every((scope) => scopes.has(scope)))
    .map((record) => record.id);
}

export function auditKeyAccess(input: AuditRequest, keys: AccountKey[]): AccessReview[] {
  return keys.map((key) => {
    const scopes = new Set(key.scopes);
    return {
      keyId: key.id,
      keyName: key.name,
      scopes: key.scopes,
      reachable: {
        maintenanceRequests: reachableIds(input.maintenanceRequests, scopes),
        tenantDocuments: reachableIds(input.tenantDocuments, scopes),
        inspectionReminders: reachableIds(input.inspectionReminders, scopes),
      },
    };
  });
}

export function renderReviewMarkdown(
  propertyName: string,
  reviewDate: string,
  reviews: AccessReview[],
): string {
  const sections = reviews.map((review) => [
    `## ${review.keyName}`,
    `Key ID: ${review.keyId}`,
    `Scopes: ${review.scopes.join(", ") || "None"}`,
    `Maintenance requests: ${review.reachable.maintenanceRequests.join(", ") || "None"}`,
    `Tenant documents: ${review.reachable.tenantDocuments.join(", ") || "None"}`,
    `Inspection reminders: ${review.reachable.inspectionReminders.join(", ") || "None"}`,
  ].join("\n\n"));

  return [`# Access review: ${propertyName}`, `Review date: ${reviewDate}`, ...sections].join("\n\n");
}
