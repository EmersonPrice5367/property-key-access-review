import { createHash } from "node:crypto";
import { auditKeyAccess, renderReviewMarkdown, type AuditRequest } from "./access_policy.js";
import { InfraiClient } from "./infrai_client.js";

export type AuditResult = {
  propertyName: string;
  reviewDate: string;
  keys: ReturnType<typeof auditKeyAccess>;
  document: unknown;
};

export async function runPropertyAudit(
  input: AuditRequest,
  infrai: InfraiClient,
  now: () => Date = () => new Date(),
): Promise<AuditResult> {
  const reviewDate = now().toISOString().slice(0, 10);
  const keys = auditKeyAccess(input, await infrai.listAccountKeys());
  const markdown = renderReviewMarkdown(input.propertyName, reviewDate, keys);
  const requestIdentity = createHash("sha256")
    .update(JSON.stringify({ input, reviewDate, keys }))
    .digest("hex");
  const document = await infrai.generatePdf(markdown, `property-access-${requestIdentity}`);

  return { propertyName: input.propertyName, reviewDate, keys, document };
}
