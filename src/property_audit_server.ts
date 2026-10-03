import { createServer } from "node:http";
import { ZodError } from "zod";
import { auditRequestSchema } from "./access_policy.js";
import { InfraiClient, InfraiError } from "./infrai_client.js";
import { runPropertyAudit } from "./property_audit_service.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("INFRAI_API_KEY is required");

const infrai = new InfraiClient(apiKey);
const port = Number(process.env.PORT ?? 3000);

function sendJson(response: import("node:http").ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(value));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/audits") {
    sendJson(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = auditRequestSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    sendJson(response, 201, await runPropertyAudit(input, infrai));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      sendJson(response, 400, { error: "Invalid audit request" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      sendJson(response, status, { error: error.code, details: error.details });
      return;
    }
    sendJson(response, 500, { error: "Audit could not be completed" });
  }
});

server.listen(port, () => {
  console.log(`Property access audit listening on http://localhost:${port}`);
});
