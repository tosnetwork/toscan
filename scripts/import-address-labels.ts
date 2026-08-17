import { readFile } from "node:fs/promises";
import pg from "pg";
import { validateAddressLabels } from "../services/query/src/labels.js";

const [manifestPath] = process.argv.slice(2);
if (!manifestPath) throw new Error("usage: pnpm labels:import <manifest.json>");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const records = validateAddressLabels(JSON.parse(await readFile(manifestPath, "utf8")));
const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  for (const record of records) {
    await client.query(
      `INSERT INTO explorer_address_labels(address,label,category,source,source_url,verified,updated_at)
       VALUES($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT(address) DO UPDATE SET label=EXCLUDED.label,category=EXCLUDED.category,
         source=EXCLUDED.source,source_url=EXCLUDED.source_url,verified=EXCLUDED.verified,
         updated_at=EXCLUDED.updated_at`,
      [record.address, record.label, record.category, record.source, record.source_url, record.verified, record.updated_at],
    );
  }
  await client.query("COMMIT");
  console.log(`Imported ${records.length} address labels`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
