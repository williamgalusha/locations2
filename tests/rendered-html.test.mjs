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
  assert.doesNotMatch(portal, /className="brand"[^\n]*PRODUCTION CONTROL/);
  assert.match(portal, /Production Sheet/);
  assert.match(portal, /Headcount/);
  assert.match(portal, /Client Portal/);
  assert.match(portal, /Reconciliation/);
  assert.match(portal, /COST REPORT BY BUDGET LINE/);
  assert.match(portal, /Allocated budget line/);
  assert.match(portal, /expense-allocation/);
  assert.match(portal, /BACKUP ALLOCATION/);
  assert.match(portal, /UPLOAD \+ ALLOCATE/);
  assert.match(portal, /Missing backup/);
  assert.match(portal, /BUDGET AUDIT NOTES/);
  assert.match(portal, /TRAFFIC-AWARE PICKUP PLANNER/);
  assert.match(portal, /AIRPORT ARRIVAL = 2 HOURS BEFORE FLIGHT/);
  assert.match(portal, /CHECK DRIVE \+ CALCULATE/);
  assert.match(portal, /ADD TRANSFER TO CHART/);
  assert.match(referenceUi, /AUDIT BUDGET/);
  assert.match(referenceUi, /budget-audit-result/);
  assert.match(referenceUi, /OPENAI \+ DOCUMENT REVIEW/);
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
  assert.match(css, /:root\[data-theme="dark"\] \.estimate-header img[^}]*mix-blend-mode:\s*screen/);
  assert.match(referenceUi, /reference-credential-form/);
  assert.match(css, /reference-credential-form label[^}]*display:\s*grid[^}]*gap:\s*6px[^}]*border:\s*0/);
  assert.match(css, /reference-credential-form input[^}]*height:\s*36px[^}]*border:\s*1px solid #111/);
  assert.match(referenceUi, /LOG IN — CLIENT/);
  assert.match(referenceUi, /LOG IN — PRODUCTION/);
  assert.doesNotMatch(referenceUi, />PRODUCTION CONTROL<\/p>/);
  assert.doesNotMatch(referenceUi, /PREVIEW (?:WORKSPACE|CLIENT PORTAL|PRODUCTION WORKSPACE)/);
  assert.match(referenceUi, /clientOnly/);
  assert.match(referenceUi, /PRODUCTION ESTIMATE/);
  assert.match(referenceUi, /SAVE AS NEW VERSION/);
  for (const control of ["↶ UNDO", "CLEAR BUDGET", "PUSH TO CLIENT PORTAL", "ADD SECTION BELOW", "REMOVE SECTION", "MARK N\/A", "REMOVE LINE", "ADD LINE", "SAVE AS NEW OVERAGE", "REACTIVATE TO EDIT"]) assert.match(referenceUi, new RegExp(control));
  assert.match(referenceUi, /draggable=\{!readOnly\}/);
  assert.match(css, /\.estimate-line[^}]*padding:\s*1px 0[^}]*font-size:\s*9px/);
  assert.match(css, /\.estimate-section[^}]*margin-top:\s*14px/);
  assert.match(referenceUi, /BILLING DETAILS/);
  assert.match(referenceUi, /CHANGES SINCE PREVIOUS VERSION/);
  assert.match(referenceUi, /ALL LINES/);
  assert.match(referenceUi, /CHANGES ONLY/);
  assert.match(referenceUi, /PUBLISHED BUDGETS/);
  assert.match(referenceUi, /COMPARE TWO VERSIONS/);
  assert.match(referenceUi, /VIEW BUDGET/);
  assert.match(referenceUi, /DOWNLOAD BUDGET PDF/);
  assert.match(referenceUi, /DOWNLOAD COMPARISON PDF/);
  assert.match(referenceUi, /getPublishedBudgetVersions/);
  assert.match(referenceUi, /versionId: clientShareVersion/);
  assert.match(css, /client-budget-library/);
  assert.match(css, /client-budget-document/);
  assert.match(referenceUi, /IMPORT FOLDERS/);
  assert.match(referenceUi, /RECENTLY DELETED/);
  assert.match(referenceUi, /PRESENTATION/);
  assert.match(referenceUi, /data-deck-frame/);
  assert.match(referenceUi, /DARK MODE/);
  assert.match(portal, /DARK MODE/);
  assert.match(portal, /USER CONTROLS/);
  assert.match(portal, /WORKSPACE PREFERENCES/);
  assert.match(portal, /aria-haspopup="dialog"/);
  assert.match(portal, /bill-compact-rows/);
  assert.match(portal, /bill-reduce-motion/);
  assert.doesNotMatch(portal, /side-user-menu/);
  assert.match(css, /user-controls-drawer/);
  assert.match(css, /data-density="compact"/);
  assert.match(css, /data-reduce-motion="true"/);
  assert.match(css, /:root:not\(\[data-theme="dark"\]\) \.sidebar[^}]*background:\s*#e4e7ea[^}]*color:\s*#111/);
  assert.match(css, /:root:not\(\[data-theme="dark"\]\) \.nav-item[^}]*color:\s*#333/);
  assert.match(css, /:root:not\(\[data-theme="dark"\]\) \.brand img[^}]*filter:\s*none/);
  assert.match(css, /:root:not\(\[data-theme="dark"\]\) \.brand img[^}]*mix-blend-mode:\s*multiply/);
  assert.doesNotMatch(portal, /mark:\s*"\d+"/);
  assert.doesNotMatch(css, /orange|coral|#ef5b3e/i);
  assert.doesNotMatch(css, /grayscale\(1\)/);
  assert.match(css, /client-theme-dark/);
  assert.match(css, /--client-bg:\s*#f3f5f6/);
  assert.doesNotMatch(css, /#f5f5f4|#ececeb|#d8d8d5|#e7e7e4|#e7e5df|#f4f4f1/);
  assert.match(css, /location-deck-stage/);
  assert.match(css, /pickup-planner/);
  assert.match(css, /pickup-result/);
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
  const [hosting, initialMigration, expandedMigration, budgetMigration, restoredMigration, auditMigration, route, fileRoute, auditRoute, travelTimeRoute, schema] = await Promise.all([
    readFile(new URL(".openai/hosting.json", root), "utf8"),
    readFile(new URL("drizzle/0000_cute_genesis.sql", root), "utf8"),
    readFile(new URL("drizzle/0001_typical_sabra.sql", root), "utf8"),
    readFile(new URL("drizzle/0002_blue_proudstar.sql", root), "utf8"),
    readFile(new URL("drizzle/0003_overconfident_northstar.sql", root), "utf8"),
    readFile(new URL("drizzle/0004_concerned_siren.sql", root), "utf8"),
    readFile(new URL("app/api/portal/route.ts", root), "utf8"),
    readFile(new URL("app/api/files/route.ts", root), "utf8"),
    readFile(new URL("app/api/audit/route.ts", root), "utf8"),
    readFile(new URL("app/api/travel-time/route.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
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
  assert.match(auditMigration, /CREATE TABLE `budget_audits`/);
  for (const column of ["budget_line_id", "expense_id", "vendor", "amount", "spend_date", "memo"]) assert.match(auditMigration, new RegExp(column));
  for (const action of ["create_project", "add_budget_line", "update_budget_line", "delete_budget_line", "rename_budget_section", "set_budget_section_na", "remove_budget_section", "clear_budget", "reorder_budget_line", "replace_budget_snapshot", "update_project_budget_meta", "save_budget_version", "set_budget_version_status", "restore_budget_version", "delete_budget_version", "add_expense", "import_expenses", "add_location", "update_location", "update_location_gallery", "set_location_visibility", "delete_location", "restore_location", "purge_location", "import_locations", "add_module_record", "update_module_record", "import_travel_reservation", "delete_module_record", "publish_client_item", "update_expense_status", "update_expense_allocation", "update_backup_status", "update_location_status", "update_project_status"]) {
    assert.match(route, new RegExp(action));
  }
  assert.match(fileRoute, /bucket\(\)\.put/);
  assert.match(fileRoute, /bucket\(\)\.delete/);
  assert.match(fileRoute, /budgetLineId/);
  assert.match(fileRoute, /expenseId/);
  assert.match(fileRoute, /isBackup = category\.toLowerCase\(\) === "backup"/);
  assert.match(fileRoute, /isBackup \? budgetLineId : ""/);
  assert.match(schema, /budgetAudits/);
  assert.match(schema, /expenseId:\s*text\("expense_id"\)/);
  assert.match(auditRoute, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(auditRoute, /OPENAI_API_KEY/);
  assert.match(auditRoute, /input_file/);
  assert.match(auditRoute, /deterministicAudit/);
  assert.match(auditRoute, /LOWER\(category\) = 'backup'/);
  assert.match(travelTimeRoute, /https:\/\/routes\.googleapis\.com\/directions\/v2:computeRoutes/);
  assert.match(travelTimeRoute, /TRAFFIC_AWARE_OPTIMAL/);
  assert.match(travelTimeRoute, /airportLeadMinutes = tripType === "to_airport" \? 120 : 0/);
  assert.match(travelTimeRoute, /GOOGLE_MAPS_API_KEY/);
  assert.match(route, /versionId: textValue\(body\.versionId\)/);
  await access(new URL("dist/server/index.js", root));
  await access(new URL("public/og.png", root));
});
