// services/ingestion/src/core.ts
import { parse } from "csv-parse";
import type { Readable } from "node:stream";

export type FragranceModel = {
  fragrance_id: string;
  name: string;
  brand: string;
  year?: number;
  country?: string;
  gender?: string;
  rating_value?: number;
  rating_count?: number;
  notes: {
    top: string[];
    middle: string[];
    base: string[];
  };
  mainaccords: string[]; // up to 5
  perfumers: string[];
};

export type CatalogDynamoItem = {
  fragrance_id: string; // PK
  fragrance: FragranceModel; // your required shape stored under "fragrance"
};

export type ParseResult = {
  items: CatalogDynamoItem[];
  processed: number;
  inserted: number;
  failed: number;
};

function cleanStr(v: any): string {
  return (v ?? "").toString().trim();
}

function toNumber(v: any): number | undefined {
  const s0 = cleanStr(v);
  if (!s0) return undefined;
  const s1 = s0.replace(",", ".");
  const n = Number(s1);
  return Number.isFinite(n) ? n : undefined;
}

function toInt(v: any): number | undefined {
  const n = toNumber(v);
  return n === undefined ? undefined : Math.trunc(n);
}

// Split notes into arrays. If the field contains "|" or ",", we split.
// Otherwise return [value]. Empty returns [].
function splitToArray(v: any): string[] {
  const s = cleanStr(v);
  if (!s) return [];
  const delim = s.includes("|") ? "|" : (s.includes(",") ? "," : null);
  if (!delim) return [s];
  return s.split(delim).map(x => x.trim()).filter(Boolean);
}

function normalizeRow(row: Record<string, string>, rowNumber: number): CatalogDynamoItem | null {
  // CSV headers:
  // url;Perfume;Brand;Country;Gender;Rating Value;Rating Count;Year;Top;Middle;Base;Perfumer1;Perfumer2;mainaccord1..5

  const name = cleanStr(row["Perfume"]);
  const brand = cleanStr(row["Brand"]);
  if (!name || !brand) return null;

  // fragrance_id is row number (simple MVP)
  const fragrance_id = `fr_${rowNumber}`;

  const fragrance: FragranceModel = {
    fragrance_id,
    name,
    brand,
    year: toInt(row["Year"]),
    country: cleanStr(row["Country"]) || undefined,
    gender: cleanStr(row["Gender"]) || undefined,
    rating_value: toNumber(row["Rating Value"]),
    rating_count: toInt(row["Rating Count"]),
    notes: {
      top: splitToArray(row["Top"]),
      middle: splitToArray(row["Middle"]),
      base: splitToArray(row["Base"])
    },
    mainaccords: [
      cleanStr(row["mainaccord1"]),
      cleanStr(row["mainaccord2"]),
      cleanStr(row["mainaccord3"]),
      cleanStr(row["mainaccord4"]),
      cleanStr(row["mainaccord5"])
    ].filter(Boolean).slice(0, 5),
    perfumers: [
      cleanStr(row["Perfumer1"]),
      cleanStr(row["Perfumer2"])
    ].filter(Boolean)
  };

  return { fragrance_id, fragrance };
}

/**
 * Parse a CSV stream and return normalized DynamoDB items.
 * No AWS calls here.
 */
export async function parseAndNormalizeCsvStream(stream: Readable): Promise<ParseResult> {
  const parser: any = parse({
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter: ";" // your file uses ;
  });

  let processed = 0;
  let inserted = 0;
  let failed = 0;

  const items: CatalogDynamoItem[] = [];
  let rowNumber = 0;

  const done = new Promise<void>((resolve, reject) => {
    parser.on("readable", () => {
      try {
        let record: any;
        while ((record = parser.read()) !== null) {
          processed += 1;
          rowNumber += 1;

          const item = normalizeRow(record, rowNumber);
          if (!item) {
            failed += 1;
            continue;
          }
          inserted += 1;
          items.push(item);
        }
      } catch (e) {
        reject(e);
      }
    });

    parser.on("error", reject);
    parser.on("end", () => resolve());
  });

  stream.pipe(parser);
  await done;

  return { items, processed, inserted, failed };
}