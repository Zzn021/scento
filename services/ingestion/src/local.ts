// services/ingestion/src/local.ts
import fs from "node:fs";
import { parseAndNormalizeCsvStream } from "./core.js";

async function run() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: node dist/local.js <path-to-csv>");
    process.exit(1);
  }

  const stream = fs.createReadStream(file);
  const { items, processed, inserted, failed } = await parseAndNormalizeCsvStream(stream);

  // Print a small summary + first 2 items as sanity check
  console.log(JSON.stringify({
    total_processed: processed,
    inserted_count: inserted,
    failed_count: failed,
    sample: items.slice(0, 2)
  }, null, 2));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});