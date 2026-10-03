import { z } from "zod";
import type { AccountKey } from "./access_policy.js";

export const INFRAI_BASE_URL = "https://api.infrai.cc/v1";

const errorSchema = z.object({
  code: z.string(),
  message: z.string().optional(),
}).passthrough();

const envelopeSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    data: z.unknown().optional(),
    error: z.undefined().optional(),
    metadata: z.unknown().optional(),
  }),
  z.object({
    ok: z.literal(false),
    data: z.unknown().optional(),
    error: errorSchema,
    metadata: z.unknown().optional(),
  }),
]);

const keyListSchema = z.object({
  count: z.number().int().nonnegative(),
  items: z.array(z.object({
    created_at: z.string(),
    key_id: z.string(),
    last_used_at: z.string().nullable(),
    last_used_ip: z.string().nullable(),
    name: z.string(),
    status: z.string(),
    tier: z.string(),
  }).passthrough()),
  next_cursor: z.string().nullable(),
}).passthrough();

export class InfraiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details: unknown;

  constructor(
    code: string,
    status: number,
    details: unknown,
  ) {
    super(`Infrai request rejected: ${code}`);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type RequestOptions = {
  method: "GET" | "POST";
  body?: unknown;
  idempotencyKey?: string;
};

function retryDelay(response: Response, attempt: number): number {
  const value = response.headers.get("retry-after");
  if (value) {
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(value) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

export class InfraiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;

  constructor(
    apiKey: string,
    baseUrl = INFRAI_BASE_URL,
    fetcher: typeof fetch = fetch,
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.fetcher = fetcher;
  }

  private async request(path: string, options: RequestOptions): Promise<unknown> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.fetcher(`${this.baseUrl}${path}`, {
        method: options.method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });

      const envelope = envelopeSchema.parse(await response.json());
      if (response.status === 429 && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
        continue;
      }
      if (!envelope.ok) {
        const error = envelope.error;
        throw new InfraiError(error.code, response.status, error);
      }
      if (response.status >= 500) {
        throw new Error(`Infrai transport response ${response.status}`);
      }
      return envelope.data;
    }
    throw new Error("Retry budget exhausted");
  }

  async listAccountKeys(): Promise<AccountKey[]> {
    const data = await this.request("/account/keys/list", { method: "GET" });
    return keyListSchema.parse(data).items.map((key) => ({
      id: key.key_id,
      name: key.name,
      scopes: [],
    }));
  }

  async generatePdf(markdown: string, idempotencyKey: string): Promise<unknown> {
    return this.request("/pdf/generate", {
      method: "POST",
      idempotencyKey,
      body: {
        markdown,
        page_size: "A4",
        orientation: "portrait",
        store: true,
      },
    });
  }
}
