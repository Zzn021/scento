import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import fs from "node:fs";
import { createReadStream } from "node:fs";
import readline from "node:readline";
import { parseAndNormalizeCsvStream } from "../src/core.js";

// const CSV_PATH = "/Users/harry/unsw/scento/services/ingestion/fra_cleaned.csv";

function streamFromString(s: string): Readable {
  return Readable.from([s], { encoding: "utf-8" });
}

async function countDataRows(filePath: string): Promise<number> {
  const rl = readline.createInterface({
    input: createReadStream(filePath),
    crlfDelay: Infinity
  });

  let lineCount = 0;
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue; // ignore empty lines
    lineCount += 1;
  }

  // first non-empty line is header
  return Math.max(0, lineCount - 1);
}

test("parse CSV and normalize rows correctly", async () => {
  const csv = [
    "url;Perfume;Brand;Country;Gender;Rating Value;Rating Count;Year;Top;Middle;Base;Perfumer1;Perfumer2;mainaccord1;mainaccord2;mainaccord3;mainaccord4;mainaccord5",
    "u1;perfume-a;brand-a;USA;unisex;2,32;100;2018;apple|pear;rose,jasmine;wood;John;Jane;fresh;woody;fruity;aromatic;floral",
    "u2;perfume-b;brand-b;France;women;1,50;70;2024;yuzu;citrus;musky;;;citrus;white floral;sweet;fresh;musky"
  ].join("\n");

  const res = await parseAndNormalizeCsvStream(streamFromString(csv));

  assert.equal(res.processed, 2);
  assert.equal(res.inserted, 2);
  assert.equal(res.failed, 0);
  assert.equal(res.items.length, 2);

  const first = res.items[0];
  assert.equal(first.fragrance_id, "fr_1");
  assert.equal(first.fragrance.fragrance_id, "fr_1");
  assert.equal(first.fragrance.name, "perfume-a");
  assert.equal(first.fragrance.brand, "brand-a");
  assert.equal(first.fragrance.year, 2018);
  assert.equal(first.fragrance.rating_value, 2.32);
  assert.equal(first.fragrance.rating_count, 100);

  assert.deepEqual(first.fragrance.notes.top, ["apple", "pear"]);
  assert.deepEqual(first.fragrance.notes.middle, ["rose", "jasmine"]);
  assert.deepEqual(first.fragrance.notes.base, ["wood"]);

  assert.deepEqual(first.fragrance.mainaccords, ["fresh", "woody", "fruity", "aromatic", "floral"]);
  assert.deepEqual(first.fragrance.perfumers, ["John", "Jane"]);

  const second = res.items[1];
  assert.equal(second.fragrance_id, "fr_2");
  assert.equal(second.fragrance.rating_value, 1.5);
  assert.deepEqual(second.fragrance.perfumers, []);
  assert.deepEqual(second.fragrance.mainaccords, ["citrus", "white floral", "sweet", "fresh", "musky"]);
});

test("rows missing Perfume or Brand are skipped and counted as failed", async () => {
  const csv = [
    "url;Perfume;Brand;Country;Gender;Rating Value;Rating Count;Year;Top;Middle;Base;Perfumer1;Perfumer2;mainaccord1;mainaccord2;mainaccord3;mainaccord4;mainaccord5",
    "u1;;brand-a;USA;unisex;2,32;100;2018;apple;rose;wood;John;Jane;fresh;woody;fruity;aromatic;floral",
    "u2;perfume-b;;France;women;1,50;70;2024;yuzu;citrus;musky;;;citrus;white floral;sweet;fresh;musky",
    "u3;perfume-c;brand-c;Italy;unisex;3,00;10;2020;;;base;;;fresh;;;;"
  ].join("\n");

  const res = await parseAndNormalizeCsvStream(streamFromString(csv));

  assert.equal(res.processed, 3);
  assert.equal(res.inserted, 1);
  assert.equal(res.failed, 2);

  const only = res.items[0];
  assert.equal(only.fragrance_id, "fr_3");
  assert.equal(only.fragrance.name, "perfume-c");
  assert.equal(only.fragrance.brand, "brand-c");
});

test("real CSV file row count matches parser processed count", async (t) => {
  const filePath = process.env.CSV_PATH ?? "../../fra_cleaned.csv";

  if (!fs.existsSync(filePath)) {
    t.skip(`CSV file not found at ${filePath}. Set CSV_PATH env var to run this test.`);
    return;
  }

  const expectedRows = await countDataRows(filePath);
  const stream = createReadStream(filePath);
  const result = await parseAndNormalizeCsvStream(stream);

  assert.equal(result.processed, expectedRows);
});