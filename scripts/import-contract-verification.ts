import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";

interface Manifest {
  address: string;
  compiler: string;
  compiler_version: string;
  repository_url: string;
  source_commit: string;
  source_digest: string;
  build_command: string;
  code_boc: string;
  [key: string]: unknown;
}

const addressPattern = /^-?\d+:[0-9a-f]{64}$/i;
const manifestPath = process.argv[2];
const databaseUrl = process.env.DATABASE_URL;
const rpcOrigin = process.env.TOS_RPC_UPSTREAM;
if (!manifestPath || !databaseUrl || !rpcOrigin) {
  throw new Error("usage: DATABASE_URL=... TOS_RPC_UPSTREAM=... pnpm verification:import manifest.json");
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;
for (const field of ["address", "compiler", "compiler_version", "repository_url", "source_commit", "source_digest", "build_command", "code_boc"] as const) {
  if (typeof manifest[field] !== "string" || !manifest[field].trim()) throw new Error(`manifest.${field} is required`);
}
if (!addressPattern.test(manifest.address)) throw new Error("manifest.address is not a raw TOS address");
if (!/^https:\/\//.test(manifest.repository_url)) throw new Error("manifest.repository_url must use HTTPS");
if (!/^[0-9a-f]{64}$/i.test(manifest.source_digest)) throw new Error("manifest.source_digest must be a SHA-256 hex digest");

const response = await fetch(`${rpcOrigin.replace(/\/$/, "")}/getAddressInformation`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ address: manifest.address }),
});
const envelope = await response.json() as { result?: { code?: string; block_id?: { seqno?: number } }; error?: unknown };
if (!response.ok || envelope.error || !envelope.result) throw new Error("could not read deployed account code from TOS RPC");
if (!envelope.result.code || envelope.result.code !== manifest.code_boc) {
  throw new Error("verification rejected: manifest code_boc does not exactly match deployed account code");
}

const normalized = JSON.stringify(manifest, Object.keys(manifest).sort());
const manifestDigest = createHash("sha256").update(normalized).digest("hex");
const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
try {
  await pool.query(
    `INSERT INTO explorer_contract_verifications
      (address,compiler,compiler_version,repository_url,source_commit,source_digest,build_command,
       code_boc,verified_at,observed_mc_seqno,manifest)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT(address) DO UPDATE SET compiler=EXCLUDED.compiler,compiler_version=EXCLUDED.compiler_version,
       repository_url=EXCLUDED.repository_url,source_commit=EXCLUDED.source_commit,
       source_digest=EXCLUDED.source_digest,build_command=EXCLUDED.build_command,code_boc=EXCLUDED.code_boc,
       verified_at=EXCLUDED.verified_at,observed_mc_seqno=EXCLUDED.observed_mc_seqno,manifest=EXCLUDED.manifest`,
    [manifest.address.toLowerCase(), manifest.compiler, manifest.compiler_version, manifest.repository_url,
      manifest.source_commit, manifest.source_digest.toLowerCase(), manifest.build_command, manifest.code_boc,
      Math.floor(Date.now() / 1000), envelope.result.block_id?.seqno ?? 0, { ...manifest, manifest_digest: manifestDigest }],
  );
  console.log(`VERIFIED: ${manifest.address} (${manifestDigest})`);
} finally {
  await pool.end();
}
