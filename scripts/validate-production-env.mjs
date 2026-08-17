const errors = [];

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) errors.push(`${name} is required`);
  return value ?? "";
}

function url(name, protocols) {
  const value = required(name);
  if (!value) return;
  try {
    const parsed = new URL(value);
    if (!protocols.includes(parsed.protocol)) errors.push(`${name} must use ${protocols.join(" or ")}`);
    if (["localhost", "127.0.0.1", "host.docker.internal"].includes(parsed.hostname)) errors.push(`${name} must not use a development-only host`);
  } catch {
    errors.push(`${name} must be an absolute URL`);
  }
}

if (process.env.NODE_ENV !== "production") errors.push("NODE_ENV must be production");
if (process.env.VITE_ENABLE_PREVIEW !== "false") errors.push("VITE_ENABLE_PREVIEW must be explicitly false");
if (!new Set(["mainnet", "testnet"]).has(required("VITE_TOS_NETWORK"))) errors.push("VITE_TOS_NETWORK must be mainnet or testnet");
url("VITE_PUBLIC_ORIGIN", ["https:"]);
url("TOS_RPC_UPSTREAM", ["http:", "https:"]);
url("TOS_SERVICE_UPSTREAM", ["http:", "https:"]);
url("TOS_SOURCE_EXPLORER", ["http:", "https:"]);

const databaseUrl = required("DATABASE_URL");
if (databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    if (!new Set(["postgres:", "postgresql:"]).has(parsed.protocol)) errors.push("DATABASE_URL must use PostgreSQL");
    if (!parsed.password) errors.push("DATABASE_URL must include a password");
    if (["toscan-local-only", "postgres", "password"].includes(decodeURIComponent(parsed.password))) errors.push("DATABASE_URL uses a known development password");
  } catch {
    errors.push("DATABASE_URL must be an absolute PostgreSQL URL");
  }
}

if (errors.length) {
  console.error(`Production configuration rejected:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log("Production configuration: PASS");
