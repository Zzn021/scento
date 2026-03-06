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

test("handler uses bucket and key from event to fetch S3 object", async () => {
  const csv = [
    "url;Perfume;Brand;Country;Gender;Rating Value;Rating Count;Year;Top;Middle;Base;Perfumer1;Perfumer2;mainaccord1;mainaccord2;mainaccord3;mainaccord4;mainaccord5",
    "u1;perfume-a;brand-a;USA;unisex;2,32;100;2018;apple;rose;wood;John;Jane;fresh;woody;fruity;aromatic;floral"
  ].join("\n");

  let capturedBucket: string | undefined;
  let capturedKey: string | undefined;

  const fakeS3 = {
    send: async (cmd: any) => {
      capturedBucket = cmd.input.Bucket;
      capturedKey = cmd.input.Key;
      return { Body: streamFromString(csv) };
    }
  };

  const fakeDdb = {
    send: async () => ({ UnprocessedItems: {} })
  };

  const handler = makeHandler({
    s3: fakeS3 as any,
    ddb: fakeDdb as any,
    env: (name) => {
      if (name === "CATALOG_TABLE") return "table";
      throw new Error("unexpected env var");
    }
  });

  await handler({ bucket: "my-bucket", key: "data/catalog.csv" });

  assert.equal(capturedBucket, "my-bucket");
  assert.equal(capturedKey, "data/catalog.csv");
});

test("handler falls back to env vars when bucket and key are omitted", async () => {
  const csv = [
    "url;Perfume;Brand;Country;Gender;Rating Value;Rating Count;Year;Top;Middle;Base;Perfumer1;Perfumer2;mainaccord1;mainaccord2;mainaccord3;mainaccord4;mainaccord5",
    "u1;perfume-a;brand-a;USA;unisex;2,32;100;2018;apple;rose;wood;John;Jane;fresh;woody;fruity;aromatic;floral"
  ].join("\n");

  let capturedBucket: string | undefined;
  let capturedKey: string | undefined;

  const fakeS3 = {
    send: async (cmd: any) => {
      capturedBucket = cmd.input.Bucket;
      capturedKey = cmd.input.Key;
      return { Body: streamFromString(csv) };
    }
  };

  const fakeDdb = {
    send: async () => ({ UnprocessedItems: {} })
  };

  const handler = makeHandler({
    s3: fakeS3 as any,
    ddb: fakeDdb as any,
    env: (name) => {
      if (name === "CATALOG_TABLE") return "table";
      if (name === "DATA_BUCKET") return "env-bucket";
      throw new Error("unexpected env var");
    }
  });

  const res: any = await handler({});

  assert.equal(capturedBucket, "env-bucket");
  assert.equal(capturedKey, "raw/catalog.csv");
  assert.equal(res.bucket, "env-bucket");
  assert.equal(res.key, "raw/catalog.csv");
});

test("handler returns correct result shape after processing S3 event", async () => {
  const csv = [
    "url;Perfume;Brand;Country;Gender;Rating Value;Rating Count;Year;Top;Middle;Base;Perfumer1;Perfumer2;mainaccord1;mainaccord2;mainaccord3;mainaccord4;mainaccord5",
    "u1;perfume-a;brand-a;USA;unisex;2,32;100;2018;apple;rose;wood;John;;fresh;woody;fruity;aromatic;floral",
    "u2;;brand-b;France;women;1,50;70;2024;yuzu;citrus;musky;;;citrus;white floral;sweet;fresh;musky",
    "u3;perfume-c;brand-c;Italy;unisex;3,00;10;2020;;;base;;;fresh;;;;"
  ].join("\n");

  const ddbItems: any[] = [];
  const fakeS3 = {
    send: async () => ({ Body: streamFromString(csv) })
  };
  const fakeDdb = {
    send: async (cmd: any) => {
      ddbItems.push(...cmd.input.RequestItems["table"]);
      return { UnprocessedItems: {} };
    }
  };

  const handler = makeHandler({
    s3: fakeS3 as any,
    ddb: fakeDdb as any,
    env: (name) => {
      if (name === "CATALOG_TABLE") return "table";
      if (name === "DATA_BUCKET") return "b";
      throw new Error("unexpected env var");
    }
  });

  const res: any = await handler({ bucket: "b", key: "k" });

  // Row 2 is missing Perfume → failed
  assert.equal(res.total_processed, 3);
  assert.equal(res.inserted_count, 2);
  assert.equal(res.failed_count, 1);
  assert.equal(res.written_count, 2);
  assert.equal(res.unprocessed_count, 0);
  assert.equal(res.bucket, "b");
  assert.equal(res.key, "k");

  // Verify the items written to DynamoDB have the expected structure
  assert.equal(ddbItems.length, 2);
  const firstItem = ddbItems[0].PutRequest.Item;
  assert.equal(firstItem.fragrance_id, "fr_1");
  assert.equal(firstItem.fragrance.name, "perfume-a");
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