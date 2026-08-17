const origin = (process.env.TOSCAN_SMOKE_ORIGIN ?? "").replace(/\/$/, "");
if (!origin) throw new Error("TOSCAN_SMOKE_ORIGIN is required");

const failures = [];
async function request(path, expected, options) {
  const response = await fetch(`${origin}${path}`, { redirect: "manual", ...options });
  if (!expected.includes(response.status)) failures.push(`${path}: expected ${expected.join("/")}, got ${response.status}`);
  return response;
}

const health = await request("/healthz", [200]);
if ((await health.text()).trim() !== "ok") failures.push("/healthz did not return ok");
const home = await request("/", [200]);
for (const header of ["content-security-policy", "x-content-type-options", "x-frame-options", "permissions-policy"]) {
  if (!home.headers.get(header)) failures.push(`missing security header: ${header}`);
}
const assertShell = async (path) => {
  const response = await request(path, [200]);
  if (!(await response.text()).includes("TOSCAN")) failures.push(`${path} does not contain the TOSCAN shell`);
};
if (!(await home.text()).includes("TOSCAN")) failures.push("home page does not contain the TOSCAN shell");
await assertShell("/validators");
await assertShell("/assets/activity");
await request("/tos-service-api/explorer/status", [200]);
await request("/tos-service-api/tasks", [404]);
await request("/tos-rpc/sendMessage", [404]);
await request("/tos-service-api/explorer/status", [403, 405], { method: "POST" });

if (failures.length) {
  console.error(`Production smoke: FAIL\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("Production smoke: PASS");
