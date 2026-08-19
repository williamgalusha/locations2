import { access, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const placeholderDatabaseId = "00000000-0000-4000-8000-000000000000";

function fail(message) {
  throw new Error(`Cloudflare deployment configuration is invalid: ${message}`);
}

const [viteSource, wranglerSource, hostingSource, workspaceSource] =
  await Promise.all([
    readFile(new URL("vite.config.ts", root), "utf8"),
    readFile(new URL("wrangler.jsonc", root), "utf8"),
    readFile(new URL(".openai/hosting.json", root), "utf8"),
    readFile(new URL("pnpm-workspace.yaml", root), "utf8"),
  ]);

if (!viteSource.includes('configPath: "./wrangler.jsonc"')) {
  fail('vite.config.ts must use configPath: "./wrangler.jsonc"');
}

if (
  viteSource.includes("localBindingConfig") ||
  viteSource.includes(placeholderDatabaseId)
) {
  fail("preview-only placeholder bindings must not be used");
}

const wrangler = JSON.parse(wranglerSource);
const hosting = JSON.parse(hostingSource);
const d1 = wrangler.d1_databases?.find(
  (entry) => entry.binding === hosting.d1,
);
const r2 = wrangler.r2_buckets?.find((entry) => entry.binding === hosting.r2);

if (!wrangler.main) fail("wrangler.jsonc is missing the Worker entrypoint");
await access(new URL(wrangler.main, root));

if (!d1?.database_id || d1.database_id === placeholderDatabaseId) {
  fail(`wrangler.jsonc must contain the real ${hosting.d1} D1 database`);
}

if (!r2?.bucket_name) {
  fail(`wrangler.jsonc must contain the real ${hosting.r2} R2 bucket`);
}

for (const dependency of ["esbuild", "sharp", "unrs-resolver", "workerd"]) {
  if (!workspaceSource.includes(`${dependency}: true`)) {
    fail(`pnpm-workspace.yaml must allow the ${dependency} build script`);
  }
}

console.log("Cloudflare deployment configuration is consistent.");
