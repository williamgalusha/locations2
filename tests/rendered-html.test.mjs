import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships the BILL, INC. production control room instead of starter preview UI", async () => {
  const [page, layout, portal, css, packageJson] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/production-portal.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);

  assert.match(page, /<ProductionPortal initialUser=\{user \? \{ name: user\.displayName, email: user\.email \} : null\} \/>/);
  assert.match(layout, /BILL, INC\. — Production Control/);
  assert.match(layout, /\/og\.png/);
  assert.match(portal, /CONTROL ROOM/);
  assert.match(portal, /Production Sheet/);
  assert.match(portal, /Headcount/);
  assert.match(portal, /Client Portal/);
  assert.match(portal, /Reconciliation/);
  assert.match(portal, /PRODUCTION,.*UNDER CONTROL/s);
  assert.match(portal, /SIGN IN WITH CHATGPT/);
  assert.match(portal, /ENTER PRODUCTION CONTROL/);
  assert.match(portal, /DARK MODE/);
  assert.doesNotMatch(portal, /mark:\s*"\d+"/);
  assert.doesNotMatch(css, /orange|coral|#ef5b3e/i);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(page + layout + portal, /codex-preview|SkeletonPreview/);
  await assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", root)));
});

test("includes durable records, file storage, budget history, and synchronized production actions", async () => {
  const [hosting, initialMigration, expandedMigration, budgetMigration, route, fileRoute] = await Promise.all([
    readFile(new URL(".openai/hosting.json", root), "utf8"),
    readFile(new URL("drizzle/0000_cute_genesis.sql", root), "utf8"),
    readFile(new URL("drizzle/0001_typical_sabra.sql", root), "utf8"),
    readFile(new URL("drizzle/0002_blue_proudstar.sql", root), "utf8"),
    readFile(new URL("app/api/portal/route.ts", root), "utf8"),
    readFile(new URL("app/api/files/route.ts", root), "utf8"),
  ]);

  assert.deepEqual(JSON.parse(hosting), { project_id: "appgprj_6a85bb83fa3481918167c327c66526d4", d1: "DB", r2: "FILES" });
  for (const table of ["projects", "budget_lines", "expenses", "locations", "activities"]) {
    assert.ok(initialMigration.includes("CREATE TABLE `" + table + "`"));
  }
  for (const table of ["module_records", "file_assets"]) {
    assert.ok(expandedMigration.includes("CREATE TABLE `" + table + "`"));
  }
  assert.ok(budgetMigration.includes("CREATE TABLE `budget_versions`"));
  for (const action of ["create_project", "add_budget_line", "update_budget_line", "save_budget_version", "set_budget_version_status", "add_expense", "import_expenses", "add_location", "update_location", "add_module_record", "update_module_record", "import_travel_reservation", "delete_module_record", "publish_client_item", "update_expense_status", "update_location_status", "update_project_status"]) {
    assert.match(route, new RegExp(action));
  }
  assert.match(fileRoute, /bucket\(\)\.put/);
  assert.match(fileRoute, /bucket\(\)\.delete/);
  await access(new URL("dist/server/index.js", root));
  await access(new URL("public/og.png", root));
});
