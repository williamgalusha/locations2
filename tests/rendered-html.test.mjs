import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships the BILL, INC. production control room instead of starter preview UI", async () => {
  const [page, layout, portal, referenceUi, css, packageJson, credentialRoute, credentialAuth] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/production-portal.tsx", root), "utf8"),
    readFile(new URL("app/reference-ui.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL("app/api/credential-login/route.ts", root), "utf8"),
    readFile(new URL("app/credential-auth.ts", root), "utf8"),
  ]);

  assert.match(page, /verifyPortalSession/);
  assert.match(page, /<ProductionPortal initialUser=\{initialUser\} \/>/);
  assert.match(layout, /BILL, INC\. — Production Control/);
  assert.match(layout, /\/og\.png/);
  assert.match(portal, /CONTROL ROOM/);
  assert.match(portal, /Production Sheet/);
  assert.match(portal, /Headcount/);
  assert.match(portal, /Client Portal/);
  assert.match(portal, /Reconciliation/);
  assert.match(referenceUi, /cover-grid-original/);
  assert.match(referenceUi, /aria-label="Click to log in"/);
  assert.doesNotMatch(referenceUi, />CLICK TO LOG IN</);
  assert.match(referenceUi, /requestAnimationFrame\(tick\)/);
  assert.doesNotMatch(referenceUi, /setTime\(/);
  assert.match(referenceUi, /Math\.max\(box\.width \/ 1920, box\.height \/ 1080\)/);
  assert.match(referenceUi, /\* 1\.08/);
  assert.match(referenceUi, /translate3d\(/);
  assert.match(css, /cover-grid-stage span[^}]*font-weight:\s*700[^}]*line-height:\s*1[^}]*letter-spacing:\s*-\.02em/);
  assert.match(css, /reference-cover-animation[^}]*height:\s*100%/);
  assert.doesNotMatch(css, /reference-cover-animation > span/);
  assert.match(css, /reference-login-panel img[^}]*height:\s*32px/);
  assert.match(css, /reference-login-options[^}]*width:\s*min\(165px/);
  assert.match(css, /reference-login-options > button[^}]*min-height:\s*23px/);
  assert.match(css, /:root\[data-theme="dark"\] \.budget-document[^}]*background:\s*#171717[^}]*color:\s*#f2f2f0/);
  assert.match(css, /:root\[data-theme="dark"\] \.estimate-header img[^}]*filter:\s*invert\(1\)/);
  assert.match(referenceUi, /reference-credential-form/);
  assert.match(css, /reference-credential-form label[^}]*display:\s*grid[^}]*gap:\s*6px[^}]*border:\s*0/);
  assert.match(css, /reference-credential-form input[^}]*height:\s*36px[^}]*border:\s*1px solid #111/);
  assert.match(referenceUi, /LOG IN — CLIENT/);
  assert.match(referenceUi, /LOG IN — PRODUCTION/);
  assert.doesNotMatch(referenceUi, />PRODUCTION CONTROL<\/p>/);
  assert.doesNotMatch(referenceUi, /PREVIEW (?:WORKSPACE|CLIENT PORTAL|PRODUCTION WORKSPACE)/);
  assert.match(referenceUi, /clientOnly/);
  assert.match(referenceUi, /PRODUCTION ESTIMATE/);
  assert.match(referenceUi, /BILLING DETAILS/);
  assert.match(referenceUi, /CHANGES SINCE PREVIOUS VERSION/);
  assert.match(referenceUi, /ALL LINES/);
  assert.match(referenceUi, /CHANGES ONLY/);
  assert.match(referenceUi, /IMPORT FOLDERS/);
  assert.match(referenceUi, /RECENTLY DELETED/);
  assert.match(referenceUi, /PRESENTATION/);
  assert.match(referenceUi, /data-deck-frame/);
  assert.match(referenceUi, /DARK MODE/);
  assert.match(portal, /DARK MODE/);
  assert.match(css, /:root:not\(\[data-theme="dark"\]\) \.sidebar[^}]*background:\s*#e7e7e4[^}]*color:\s*#111/);
  assert.match(css, /:root:not\(\[data-theme="dark"\]\) \.nav-item[^}]*color:\s*#333/);
  assert.match(css, /:root:not\(\[data-theme="dark"\]\) \.brand img[^}]*filter:\s*none/);
  assert.doesNotMatch(portal, /mark:\s*"\d+"/);
  assert.doesNotMatch(css, /orange|coral|#ef5b3e/i);
  assert.doesNotMatch(css, /grayscale\(1\)/);
  assert.match(css, /client-theme-dark/);
  assert.match(css, /location-deck-stage/);
  assert.match(credentialRoute, /PORTAL_SESSION_COOKIE/);
  assert.match(credentialRoute, /role === "client"/);
  assert.match(credentialAuth, /PORTAL_PASSWORD/);
  assert.match(credentialAuth, /CLIENT_PORTAL_PASSWORD/);
  assert.doesNotMatch(credentialAuth + credentialRoute, /williamblake/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(css, /data-print-surface="budget"/);
  assert.doesNotMatch(page + layout + portal + referenceUi, /codex-preview|SkeletonPreview/);
  await assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", root)));
  await access(new URL("public/bill-inc.png", root));
});

test("includes durable records, file storage, budget history, and synchronized production actions", async () => {
  const [hosting, initialMigration, expandedMigration, budgetMigration, restoredMigration, route, fileRoute] = await Promise.all([
    readFile(new URL(".openai/hosting.json", root), "utf8"),
    readFile(new URL("drizzle/0000_cute_genesis.sql", root), "utf8"),
    readFile(new URL("drizzle/0001_typical_sabra.sql", root), "utf8"),
    readFile(new URL("drizzle/0002_blue_proudstar.sql", root), "utf8"),
    readFile(new URL("drizzle/0003_overconfident_northstar.sql", root), "utf8"),
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
  for (const column of ["section_code", "item_code", "contact_email", "gallery", "deleted_at", "client_visible"]) assert.match(restoredMigration, new RegExp(column));
  for (const action of ["create_project", "add_budget_line", "update_budget_line", "delete_budget_line", "update_project_budget_meta", "save_budget_version", "set_budget_version_status", "add_expense", "import_expenses", "add_location", "update_location", "update_location_gallery", "set_location_visibility", "delete_location", "restore_location", "purge_location", "import_locations", "add_module_record", "update_module_record", "import_travel_reservation", "delete_module_record", "publish_client_item", "update_expense_status", "update_location_status", "update_project_status"]) {
    assert.match(route, new RegExp(action));
  }
  assert.match(fileRoute, /bucket\(\)\.put/);
  assert.match(fileRoute, /bucket\(\)\.delete/);
  await access(new URL("dist/server/index.js", root));
  await access(new URL("public/og.png", root));
});
