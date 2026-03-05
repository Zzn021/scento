import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { makeHandler } from "../src/handler.js";

function streamFromString(s: string): Readable {
  return Readable.from([s], { encoding: "utf-8" });
}

test("handler reads from S3 and writes to DynamoDB in batches", async () => {
  const csv = [
    "url;Perfume;Brand;Country;Gender;Rating Value;Rating Count;Year;Top;Middle;Base;Perfumer1;Perfumer2;mainaccord1;mainaccord2;mainaccord3;mainaccord4;mainaccord5",
    "u1;perfume-a;brand-a;USA;unisex;2,32;100;2018;apple|pear;rose,jasmine;wood;John;Jane;fresh;woody;fruity;aromatic;floral"
  ].join("\n");

  let s3Called = 0;
  const fakeS3 = {
    send: async (_cmd: any) => {
      s3Called += 1;
      return { Body: streamFromString(csv) };
    }
  };

  const batchCalls: any[] = [];
  const fakeDdb = {
    send: async (cmd: any) => {
      batchCalls.push(cmd);
      return { UnprocessedItems: {} }; // everything processed
    }
  };

  const handler = makeHandler({
    s3: fakeS3 as any,
    ddb: fakeDdb as any,
    env: (name) => {
      if (name === "CATALOG_TABLE") return "scento-dev-catalog";
      if (name === "DATA_BUCKET") return "scento-dev-data-scento";
      throw new Error("unexpected env var");
    }
  });

  const res: any = await handler({ bucket: "b", key: "k" });

  assert.equal(s3Called, 1);
  assert.equal(batchCalls.length, 1); // 1 item => 1 batch
  assert.equal(res.total_processed, 1);
  assert.equal(res.inserted_count, 1);
  assert.equal(res.failed_count, 0);
  assert.equal(res.written_count, 1);
  assert.equal(res.unprocessed_count, 0);
});

test("handler splits into multiple DynamoDB batches when >25 items", async () => {
  const header =
    "url;Perfume;Brand;Country;Gender;Rating Value;Rating Count;Year;Top;Middle;Base;Perfumer1;Perfumer2;mainaccord1;mainaccord2;mainaccord3;mainaccord4;mainaccord5";

  const rows: string[] = [];
  for (let i = 1; i <= 26; i++) {
    // Exactly 18 fields (17 semicolons)
    rows.push(
      `u${i};p${i};b${i};USA;unisex;1,00;1;2020;top;mid;base;;;a;b;c;d;e`
    );
    // Explanation:
    // Perfumer1 empty, Perfumer2 empty -> ";;"
    // then 5 accords a..e
  }

  const csv = [header, ...rows].join("\n");

  const fakeS3 = { send: async () => ({ Body: Readable.from([csv]) }) };

  let batchWriteCalls = 0;
  const fakeDdb = {
    send: async (_cmd: any) => {
      batchWriteCalls += 1;
      return { UnprocessedItems: {} };
    }
  };

  const handler = makeHandler({
    s3: fakeS3 as any,
    ddb: fakeDdb as any,
    env: (name) => (name === "CATALOG_TABLE" ? "t" : "b")
  });

  const res: any = await handler({});

  assert.equal(res.total_processed, 26);
  assert.equal(res.inserted_count, 26);
  assert.equal(batchWriteCalls, 2); // 25 + 1
});