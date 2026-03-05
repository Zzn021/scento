import type { Readable } from "node:stream";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { BatchWriteCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { parseAndNormalizeCsvStream, type CatalogDynamoItem } from "./core.js";

type IngestionEvent = { bucket?: string; key?: string };

export type HandlerDeps = {
  s3: Pick<S3Client, "send">;
  ddb: Pick<DynamoDBDocumentClient, "send">;
  parseFn?: typeof parseAndNormalizeCsvStream;
  env?: (name: string) => string;
};

function defaultEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function getS3Stream(s3: Pick<S3Client, "send">, bucket: string, key: string): Promise<Readable> {
  const out: any = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!out.Body) throw new Error("S3 object body is empty");
  return out.Body as Readable;
}

async function batchWriteWithRetry(
  ddb: Pick<DynamoDBDocumentClient, "send">,
  tableName: string,
  items: CatalogDynamoItem[],
  maxRetries = 6
): Promise<{ written: number; unprocessed: number }> {
  let written = 0;
  let pending: any[] = items.map((item) => ({ PutRequest: { Item: item } }));

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const resp: any = await ddb.send(new BatchWriteCommand({ RequestItems: { [tableName]: pending } }));
    const left: any[] = (resp.UnprocessedItems?.[tableName] as any[]) ?? [];

    written += pending.length - left.length;
    if (left.length === 0) return { written, unprocessed: 0 };

    pending = left;
    const backoffMs = Math.min(2000, 100 * 2 ** attempt);
    await new Promise((r) => setTimeout(r, backoffMs));
  }

  return { written, unprocessed: pending.length };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
}

export function makeHandler(deps: HandlerDeps) {
  const parseFn = deps.parseFn ?? parseAndNormalizeCsvStream;
  const env = deps.env ?? defaultEnv;

  return async (event: IngestionEvent) => {
    const tableName = env("CATALOG_TABLE");
    const bucket = event.bucket ?? env("DATA_BUCKET");
    const key = event.key ?? "raw/catalog.csv";

    const stream = await getS3Stream(deps.s3, bucket, key);
    const { items, processed, inserted, failed } = await parseFn(stream);

    let written_total = 0;
    let unprocessed_total = 0;

    for (const batch of chunk(items, 25)) {
      const { written, unprocessed } = await batchWriteWithRetry(deps.ddb, tableName, batch);
      written_total += written;
      unprocessed_total += unprocessed;
    }

    return {
      bucket,
      key,
      total_processed: processed,
      inserted_count: inserted,
      failed_count: failed,
      written_count: written_total,
      unprocessed_count: unprocessed_total
    };
  };
}