import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships the BILL, INC. production control room instead of starter preview UI", async () => {
  const [page, layout, portal, travelView, optionsWorkspace, scheduleBuilder, scheduleRoute, referenceUi, css, packageJson, credentialRoute, credentialAuth, accessRoute, libraryRoute] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/production-portal.tsx", root), "utf8"),
    readFile(new URL("app/travel-view.tsx", root), "utf8"),
    readFile(new URL("app/options-workspace.tsx", root), "utf8"),
    readFile(new URL("app/schedule-builder.tsx", root), "utf8"),
    readFile(new URL("app/api/schedule-builder/route.ts", root), "utf8"),
    readFile(new URL("app/reference-ui.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL("app/api/credential-login/route.ts", root), "utf8"),
    readFile(new URL("app/credential-auth.ts", root), "utf8"),
    readFile(new URL("app/api/access/route.ts", root), "utf8"),
    readFile(new URL("app/api/library-files/route.ts", root), "utf8"),
  ]);

  assert.match(page, /verifyPortalSession/);
  assert.match(page, /<ProductionPortal initialUser=\{initialUser\} \/>/);
  assert.match(layout, /BILL, INC\. — Production Control/);
  assert.match(layout, /\/og\.png/);
  assert.match(portal, /CONTROL ROOM/);
  assert.doesNotMatch(portal, /className="budget-meter"/);
  assert.doesNotMatch(portal, /% COMMITTED<\/b><span>/);
  assert.doesNotMatch(portal, /portal-loading|OPENING PRODUCTION WORKSPACE/);
  assert.match(portal, /const loaded = await loadProject\(\)/);
  assert.match(portal, /if \(!data && !error\) return null/);
  assert.doesNotMatch(portal, /className="brand"[^\n]*PRODUCTION CONTROL/);
  assert.match(portal, /Production Sheet/);
  assert.match(portal, /Headcount/);
  assert.match(portal, /PHONE NUMBER/);
  assert.match(portal, /DEPARTMENT/);
  assert.match(portal, /DIETARY RESTRICTIONS/);
  assert.match(portal, /SHOOT-DAY CALLS/);
  assert.match(portal, /ADD SHOOT DAY/);
  assert.match(portal, /JOB HEADCOUNT/);
  assert.match(portal, /crewCallDays\(record, project, general\)/);
  assert.match(portal, /Client Portal/);
  assert.match(portal, /Casting/);
  assert.match(portal, /Art Buying/);
  assert.match(portal, /Project Settings/);
  assert.match(portal, /PortalAccountWorkspace/);
  assert.match(portal, /WELCOME,/);
  assert.match(portal, /Jobs by year/i);
  assert.match(portal, /Location Library/i);
  assert.match(portal, /locationLibraryProjectId/);
  assert.match(portal, /function openLocationLibrary\(\)/);
  assert.doesNotMatch(portal, /item\.id === "locations" \? void openProjectLocations\(data\.project\.id\)/);
  assert.match(portal, /active === "locations" && <ReferenceLocationsView/);
  assert.match(portal, /switchProject=\{openJobLocations\}/);
  assert.match(portal, /FULL LIBRARY · ALL JOBS/);
  assert.match(portal, /LOCATION LIBRARY · PROJECT PAGE|ReferenceLocationsView/);
  assert.match(portal, /Templates & Guides/i);
  assert.match(portal, /TemplatesGuidesView/);
  assert.match(portal, /\/api\/library-files/);
  assert.match(portal, /SAVE PROJECT SETTINGS/);
  assert.match(portal, /update_project_details/);
  assert.match(portal, /PROJECT SUMMARY \/ SCOPE/);
  assert.match(portal, /Reconciliation/);
  assert.match(portal, /COST REPORT BY BUDGET LINE/);
  assert.match(portal, /CLICK A WORKING NUMBER TO EDIT ITS VENDORS/);
  assert.match(portal, /ACTUAL.*Amounts supported by uploaded backup/);
  assert.match(portal, /SAVE WORKING COSTS/);
  assert.match(portal, /ADD ANOTHER VENDOR/);
  assert.match(portal, /publishReconciliation/);
  assert.match(portal, /kind: "Reconciliation"/);
  assert.match(portal, /Reconciliation snapshot pushed to the client portal/);
  assert.match(portal, /BACKUP LINKED/);
  assert.match(portal, /NO BACKUP/);
  assert.match(portal, /actual = data\?\.files\.filter/);
  assert.match(portal, /expense-allocation/);
  assert.match(portal, /BACKUP ALLOCATION/);
  assert.match(portal, /UPLOAD \+ ALLOCATE/);
  assert.match(portal, /Missing backup/);
  assert.match(portal, /BUDGET AUDIT NOTES/);
  assert.match(portal, /DOCUMENT \+ COST AUDIT/);
  assert.match(portal, /DOCUMENT REVIEW/);
  assert.doesNotMatch(portal, /OpenAI budget audit complete|OpenAI fallback|OpenAI audit fell back/);
  assert.match(portal, /TRAFFIC-AWARE PICKUP PLANNER/);
  assert.match(portal, /AIRPORT ARRIVAL = 2 HOURS BEFORE FLIGHT/);
  assert.match(portal, /CHECK DRIVE \+ CALCULATE/);
  assert.match(portal, /ADD TRANSFER TO CHART/);
  assert.match(portal, /Payment responsibility/);
  assert.match(portal, /Charges covered/);
  assert.match(portal, /Hotel notes/);
  for (const feature of ["TRAVEL DESK", "FLIGHTS", "HOTEL CHARTS", "CAR BOOKINGS", "TRAVEL MEMOS", "EXPORT MEMO PDF", "EXCEL ↓", "PDF ↓"]) assert.match(travelView, new RegExp(feature));
  assert.match(travelView, /function TravelerSearch/);
  assert.match(travelView, /role="combobox"/);
  assert.match(travelView, /aria-autocomplete="list"/);
  assert.match(travelView, /Show all travelers/);
  assert.match(travelView, /name\.toLocaleLowerCase\(\)\.includes\(query\)/);
  assert.doesNotMatch(travelView, /datalist id="travel-memo-names"/);
  assert.match(travelView, /PUSH TO CLIENT →/);
  assert.match(travelView, /kind: "Travel Memo"/);
  assert.match(travelView, /MASTER HOTEL ROOMING LIST/);
  for (const field of ["PAYMENT RESPONSIBILITY", "CHARGES", "CONFIRMATION #", "TOTAL NIGHTS", "TOTAL QUANTITY REQUIRED", "TOTAL ROOMS REQUIRED"]) assert.match(travelView, new RegExp(field));
  assert.match(travelView, /roomingDateHeader/);
  assert.match(travelView, /room-night/);
  assert.match(travelView, /checkout/);
  assert.match(travelView, /paymentResponsibility/);
  assert.match(travelView, /xSplit="\$\{freezeColumns\}" ySplit="6"/);
  assert.match(travelView, /mergeCells count="4"/);
  assert.doesNotMatch(travelView, /"PROJECTED"/);
  assert.doesNotMatch(travelView, /Nightly rate/);
  assert.match(travelView, /CHANGES SINCE LAST EXPORT/);
  assert.match(travelView, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
  assert.match(travelView, /module: "travel_export"/);
  assert.match(travelView, /Document parsing routes/);
  assert.match(travelView, /replace\(\/OpenAI\/gi, "Document"\)/);
  assert.doesNotMatch(travelView, /AI parsing routes/);
  assert.match(referenceUi, /AUDIT BUDGET/);
  assert.match(referenceUi, /budget-audit-result/);
  assert.match(referenceUi, /DOCUMENT REVIEW/);
  assert.match(referenceUi, /client-budget-subnav/);
  assert.match(referenceUi, /ALL PUBLISHED ITEMS/);
  assert.match(referenceUi, /action: "unpublish_client_item"/);
  assert.match(referenceUi, /Removing an item only hides the client-facing copy/);
  assert.match(referenceUi, />REMOVE<\/button>/);
  assert.match(referenceUi, /PUBLISHED COST REPORT/);
  assert.match(referenceUi, /PUBLISHED SNAPSHOT/);
  assert.match(referenceUi, /remains unchanged until production publishes a new reconciliation/);
  assert.doesNotMatch(referenceUi, /ClientReconciliation\(\{ expenses/);
  assert.doesNotMatch(referenceUi, /PUBLISHED TRAVEL/);
  assert.doesNotMatch(referenceUi, /Open the individual itineraries/);
  assert.doesNotMatch(referenceUi, /traveler’s memo will appear here/);
  assert.match(css, /\.original-client-portal \.client-page-title \{ font-size: 38px; font-weight: 900; \}/);
  assert.match(referenceUi, /DOWNLOAD MEMO PDF/);
  assert.match(referenceUi, /\{ page: "Travel"/);
  assert.doesNotMatch(referenceUi, /\{ page: "Reconciliation"/);
  assert.doesNotMatch(referenceUi, /OPENAI \+ DOCUMENT REVIEW/);
  assert.match(referenceUi, /cover-grid-original/);
  assert.match(referenceUi, /aria-label="Click to log in"/);
  assert.doesNotMatch(referenceUi, />CLICK TO LOG IN</);
  assert.match(referenceUi, /requestAnimationFrame\(tick\)/);
  assert.match(referenceUi, /COVER_PLAYBACK_RATE = 1\.3/);
  assert.match(referenceUi, /glyphVisibility/);
  assert.match(referenceUi, /glyphTransforms/);
  assert.match(referenceUi, /visibilitychange/);
  assert.doesNotMatch(referenceUi, /setTime\(/);
  assert.match(referenceUi, /Math\.max\(box\.width \/ 1920, box\.height \/ 1080\)/);
  assert.match(referenceUi, /\* 1\.08/);
  assert.match(referenceUi, /translate3d\(/);
  assert.match(css, /cover-grid-stage span[^}]*font-weight:\s*700[^}]*line-height:\s*1[^}]*letter-spacing:\s*-\.02em/);
  assert.match(css, /cover-grid-stage[^}]*contain:\s*layout paint style/);
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
  assert.doesNotMatch(referenceUi, /CLIENT-READY VERSION/);
  assert.match(referenceUi, /COMPARE TWO VERSIONS/);
  assert.match(referenceUi, /VIEW BUDGET/);
  assert.match(referenceUi, /DOWNLOAD BUDGET PDF/);
  assert.match(referenceUi, /DOWNLOAD COMPARISON PDF/);
  assert.match(referenceUi, /COMMENT ON BUDGET/);
  assert.match(referenceUi, /add_budget_comment/);
  assert.match(referenceUi, /budget-comment-inbox/);
  for (const pageName of ["Casting", "Art Buying"]) assert.match(referenceUi, new RegExp(`page: "${pageName}"`));
  for (const sectionName of ["Photographer", "Director", "DP", "Set Design", "Hair Stylist", "Makeup Artist", "Manicurist", "BTS"]) assert.match(optionsWorkspace, new RegExp(sectionName));
  for (const feature of ["PUSH FULL DECK", "PUSH SECTION", "VIEW DECK", "EXPORT PDF", "VIEW PORTFOLIO / REEL", "ClientOptionsLibrary"]) assert.match(optionsWorkspace, new RegExp(feature));
  assert.match(optionsWorkspace, /action: "update_module_record"/);
  assert.match(optionsWorkspace, /snapshot: JSON\.stringify/);
  assert.match(css, /options-workspace/);
  assert.match(css, /options-deck-page/);
  assert.match(css, /budget-comment-composer/);
  for (const feature of ["SCHEDULE BUILDER", "BASIC QUESTIONS", "FOLLOW-UP QUESTIONS", "NOTES", "REQUEST EDIT", "APPLY TO LIVE SCHEDULE", "BOARD", "LOOK", "TALENT", "SET \/ LOCATION"]) assert.match(scheduleBuilder, new RegExp(feature));
  assert.match(scheduleBuilder, /\/api\/schedule-builder/);
  assert.match(scheduleBuilder, /action: "replace_schedule"/);
  assert.match(scheduleRoute, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(scheduleRoute, /OPENAI_SCHEDULE_MODEL/);
  assert.match(scheduleRoute, /json_schema/);
  assert.match(scheduleRoute, /follow-up questions/i);
  assert.match(portal, /moduleRows\(data, "schedule_builder"\)/);
  assert.match(portal, /<ScheduleWorkspace/);
  assert.match(css, /schedule-builder-layout/);
  assert.match(css, /schedule-sheet\.detailed/);
  assert.match(referenceUi, /getPublishedBudgetVersions/);
  assert.match(referenceUi, /versionId: clientShareVersion/);
  assert.match(css, /client-budget-library/);
  assert.match(css, /client-reconciliation-metrics/);
  assert.match(css, /client-published-manager/);
  assert.match(referenceUi, /function ClientBudgetDocument[\s\S]*className="budget-document" data-budget-document/);
  assert.doesNotMatch(referenceUi, /className="client-budget-document"/);
  assert.match(css, /data-print-surface="client-budget"[^}]*\.budget-document/);
  assert.match(referenceUi, /IMPORT FOLDERS/);
  assert.match(referenceUi, /LOCATION LIBRARY · PROJECT PAGE/);
  assert.match(referenceUi, /← ALL LOCATIONS/);
  assert.match(referenceUi, /RECENTLY DELETED/);
  assert.match(referenceUi, /PRESENTATION/);
  assert.match(referenceUi, /data-deck-frame/);
  assert.match(referenceUi, /PRODUCTION VIEW ↙/);
  assert.match(referenceUi, /client-theme-\$\{theme\}/);
  assert.match(referenceUi, /className="theme-button"/);
  assert.doesNotMatch(referenceUi, /clientTheme === "light" \? "DARK MODE" : "LIGHT MODE"/);
  assert.match(portal, /DARK MODE/);
  assert.match(portal, /theme=\{theme\} toggleTheme=\{toggleTheme\}/);
  assert.match(portal, /LAST_PROJECT_TTL = 24 \* 60 \* 60 \* 1000/);
  assert.match(portal, /useState\(Boolean\(initialUser\)\)/);
  assert.match(portal, /rememberProject\(projectId\)/);
  assert.match(portal, /new URLSearchParams\(window\.location\.hash/);
  assert.match(portal, /requestedProject !== recent\.projectId/);
  assert.match(portal, /function openAccountHome/);
  assert.match(portal, /window\.history\.replaceState\(null, "", `\$\{window\.location\.pathname\}\$\{window\.location\.search\}`\)/);
  assert.match(portal, /type="button" className="brand" onClick=\{\(\) => openAccountHome\(\)\}/);
  assert.match(portal, /onAccountHome=\{\(\) =>/);
  assert.match(portal, /USER CONTROLS/);
  assert.match(portal, /ADMIN ACCESS/);
  assert.match(portal, /ADD USER/);
  assert.match(portal, /Selected projects only/);
  assert.match(portal, /WORKSPACE PREFERENCES/);
  assert.match(portal, /aria-haspopup="dialog"/);
  assert.match(portal, /bill-compact-rows/);
  assert.match(portal, /bill-reduce-motion/);
  assert.doesNotMatch(portal, /side-user-menu/);
  assert.match(css, /user-controls-drawer/);
  assert.match(css, /account-portal-shell/);
  assert.match(css, /account-destination-grid/);
  assert.match(css, /unified-location-library/);
  assert.match(css, /unified-location-body/);
  assert.match(css, /template-upload-panel/);
  assert.match(css, /data-density="compact"/);
  assert.match(css, /data-reduce-motion="true"/);
  assert.match(css, /:root:not\(\[data-theme="dark"\]\) \.sidebar[^}]*background:\s*#e7e7e4[^}]*color:\s*#111/);
  assert.match(css, /:root:not\(\[data-theme="dark"\]\) \.nav-item[^}]*color:\s*#333/);
  assert.match(css, /:root:not\(\[data-theme="dark"\]\) \.brand img[^}]*filter:\s*none/);
  assert.match(css, /:root:not\(\[data-theme="dark"\]\) \.brand img[^}]*mix-blend-mode:\s*multiply/);
  assert.doesNotMatch(portal, /mark:\s*"\d+"/);
  assert.doesNotMatch(css, /orange|coral|#ef5b3e/i);
  assert.doesNotMatch(css, /grayscale\(1\)/);
  assert.match(css, /client-theme-dark/);
  assert.match(css, /location-deck-stage/);
  assert.match(css, /pickup-planner/);
  assert.match(css, /pickup-result/);
  assert.match(credentialRoute, /PORTAL_SESSION_COOKIE/);
  assert.match(credentialRoute, /role === "client"/);
  assert.match(credentialAuth, /PORTAL_BOOTSTRAP_USERNAME/);
  assert.match(credentialAuth, /PORTAL_BOOTSTRAP_PASSWORD/);
  assert.match(credentialAuth, /PBKDF2/);
  assert.match(credentialAuth, /portal_users/);
  assert.match(credentialAuth, /portal_user_projects/);
  assert.match(credentialAuth, /authorizePortalRequest/);
  assert.match(credentialAuth, /process\.env/);
  assert.match(accessRoute, /save_user/);
  assert.match(accessRoute, /set_user_active/);
  assert.match(accessRoute, /Administrator access is required/);
  assert.match(libraryRoute, /authorization\.isAdmin/);
  assert.match(libraryRoute, /bucket\(\)\.put/);
  assert.match(libraryRoute, /bucket\(\)\.delete/);
  assert.match(referenceUi, /CLIENT LOGIN/);
  assert.match(referenceUi, /set_client_credential/);
  assert.match(referenceUi, /disable_client_credential/);
  assert.match(css, /client-credential-manager/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(css, /data-print-surface="budget"/);
  assert.doesNotMatch(page + layout + portal + referenceUi, /codex-preview|SkeletonPreview/);
  await assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", root)));
  await access(new URL("public/bill-inc.png", root));
});

test("includes durable records, file storage, budget history, and synchronized production actions", async () => {
  const [hosting, initialMigration, expandedMigration, budgetMigration, restoredMigration, auditMigration, authMigration, libraryMigration, libraryIndexMigration, route, fileRoute, auditRoute, travelTimeRoute, schema] = await Promise.all([
    readFile(new URL(".openai/hosting.json", root), "utf8"),
    readFile(new URL("drizzle/0000_cute_genesis.sql", root), "utf8"),
    readFile(new URL("drizzle/0001_typical_sabra.sql", root), "utf8"),
    readFile(new URL("drizzle/0002_blue_proudstar.sql", root), "utf8"),
    readFile(new URL("drizzle/0003_overconfident_northstar.sql", root), "utf8"),
    readFile(new URL("drizzle/0004_concerned_siren.sql", root), "utf8"),
    readFile(new URL("drizzle/0005_nappy_cannonball.sql", root), "utf8"),
    readFile(new URL("drizzle/0008_productive_reaper.sql", root), "utf8"),
    readFile(new URL("drizzle/0009_spicy_fixer.sql", root), "utf8"),
    readFile(new URL("app/api/portal/route.ts", root), "utf8"),
    readFile(new URL("app/api/files/route.ts", root), "utf8"),
    readFile(new URL("app/api/audit/route.ts", root), "utf8"),
    readFile(new URL("app/api/travel-time/route.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
  ]);

  assert.deepEqual(JSON.parse(hosting), { project_id: "appgprj_6a85bb83fa3481918167c327c66526d4", d1: "DB", r2: "FILES" });
  assert.match(route, /reconciliationSnapshot/);
  assert.match(route, /openCommitment/);
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
  assert.match(authMigration, /CREATE TABLE `portal_users`/);
  assert.match(authMigration, /CREATE TABLE `portal_user_projects`/);
  assert.match(libraryMigration, /CREATE TABLE `library_files`/);
  assert.match(libraryIndexMigration, /idx_library_files_category_created/);
  for (const action of ["create_project", "update_project_details", "set_client_credential", "disable_client_credential", "add_budget_line", "update_budget_line", "delete_budget_line", "rename_budget_section", "set_budget_section_na", "remove_budget_section", "clear_budget", "reorder_budget_line", "replace_budget_snapshot", "update_project_budget_meta", "save_budget_version", "set_budget_version_status", "restore_budget_version", "delete_budget_version", "add_expense", "save_working_allocations", "import_expenses", "add_location", "update_location", "update_location_gallery", "set_location_visibility", "delete_location", "restore_location", "purge_location", "import_locations", "add_budget_comment", "resolve_budget_comment", "add_module_record", "update_module_record", "import_travel_reservation", "delete_module_record", "publish_client_item", "update_expense_status", "update_expense_allocation", "update_backup_status", "update_location_status", "update_project_status"]) {
    assert.match(route, new RegExp(action));
  }
  assert.match(fileRoute, /bucket\(\)\.put/);
  assert.match(fileRoute, /bucket\(\)\.delete/);
  assert.match(fileRoute, /budgetLineId/);
  assert.match(fileRoute, /expenseId/);
  assert.match(fileRoute, /isBackup = category\.toLowerCase\(\) === "backup"/);
  assert.match(fileRoute, /isBackup \? budgetLineId : ""/);
  assert.match(fileRoute, /DELETE FROM expenses WHERE id = \?/);
  assert.match(schema, /budgetAudits/);
  assert.match(schema, /libraryFiles/);
  assert.match(schema, /expenseId:\s*text\("expense_id"\)/);
  assert.match(auditRoute, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(auditRoute, /OPENAI_API_KEY/);
  assert.match(auditRoute, /process\.env/);
  assert.match(auditRoute, /input_file/);
  assert.match(auditRoute, /deterministicAudit/);
  assert.match(auditRoute, /LOWER\(category\) = 'backup'/);
  assert.match(travelTimeRoute, /https:\/\/routes\.googleapis\.com\/directions\/v2:computeRoutes/);
  assert.match(travelTimeRoute, /TRAFFIC_AWARE_OPTIMAL/);
  assert.match(travelTimeRoute, /airportLeadMinutes = tripType === "to_airport" \? 120 : 0/);
  assert.match(travelTimeRoute, /GOOGLE_MAPS_API_KEY/);
  assert.match(travelTimeRoute, /process\.env/);
  assert.match(route, /versionId: textValue\(body\.versionId\)/);
  assert.match(route, /traveler: textValue\(body\.traveler\)/);
  assert.match(route, /parser === "document" \? "Document" : "Text"/);
  assert.match(route, /"travel_export"/);
  assert.match(route, /"casting"/);
  assert.match(route, /"art_buying"/);
  assert.match(route, /"budget_comment"/);
  assert.match(route, /snapshot = typeof body\.snapshot/);
  assert.match(route, /\["update_location_status", "add_budget_comment"\]/);
  await access(new URL("dist/server/index.js", root));
  await access(new URL("public/og.png", root));
});
