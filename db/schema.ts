import { index, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  client: text("client").notNull(),
  code: text("code").notNull(),
  status: text("status").notNull(),
  shootStart: text("shoot_start").notNull(),
  shootEnd: text("shoot_end").notNull(),
  currency: text("currency").notNull(),
  createdAt: text("created_at").notNull(),
  contact: text("contact").notNull().default(""),
  contactEmail: text("contact_email").notNull().default(""),
  billingAddress: text("billing_address").notNull().default(""),
  poNo: text("po_no").notNull().default(""),
  budgetNotes: text("budget_notes").notNull().default(""),
  budgetChanges: text("budget_changes").notNull().default(""),
  markupPct: real("markup_pct").notNull().default(10),
  insurancePct: real("insurance_pct").notNull().default(5),
});

export const budgetLines = sqliteTable("budget_lines", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  estimate: real("estimate").notNull(),
  actual: real("actual").notNull(),
  createdAt: text("created_at").notNull(),
  sectionCode: text("section_code").notNull().default(""),
  itemCode: text("item_code").notNull().default(""),
  itemName: text("item_name").notNull().default(""),
  rate: real("rate").notNull().default(0),
  quantity: real("quantity").notNull().default(1),
  days: real("days").notNull().default(1),
  taxPct: real("tax_pct").notNull().default(0),
  isNa: real("is_na").notNull().default(0),
  naNote: text("na_note").notNull().default(""),
});

export const budgetVersions = sqliteTable("budget_versions", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  snapshot: text("snapshot").notNull(),
  createdAt: text("created_at").notNull(),
});

export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  budgetLineId: text("budget_line_id").notNull(),
  vendor: text("vendor").notNull(),
  amount: real("amount").notNull(),
  spendDate: text("spend_date").notNull(),
  status: text("status").notNull(),
  memo: text("memo").notNull(),
  createdAt: text("created_at").notNull(),
});

export const locations = sqliteTable("locations", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  rate: real("rate").notNull(),
  status: text("status").notNull(),
  imageUrl: text("image_url").notNull(),
  tags: text("tags").notNull(),
  note: text("note").notNull(),
  clientNote: text("client_note").notNull(),
  updatedAt: text("updated_at").notNull(),
  category: text("category").notNull().default("Uncategorized"),
  squareFeet: text("square_feet").notNull().default("—"),
  availability: text("availability").notNull().default("Availability Pending"),
  blurb: text("blurb").notNull().default(""),
  gallery: text("gallery").notNull().default("[]"),
  deletedAt: text("deleted_at").notNull().default(""),
  clientVisible: real("client_visible").notNull().default(1),
  address: text("address").notNull().default(""),
  latitude: real("latitude"),
  longitude: real("longitude"),
  mapsUrl: text("maps_url").notNull().default(""),
  streetViewUrl: text("street_view_url").notNull().default(""),
  mapX: real("map_x").notNull().default(-1),
  mapY: real("map_y").notNull().default(-1),
});

export const activities = sqliteTable("activities", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  kind: text("kind").notNull(),
  message: text("message").notNull(),
  actor: text("actor").notNull(),
  createdAt: text("created_at").notNull(),
});

export const moduleRecords = sqliteTable("module_records", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  module: text("module").notNull(),
  data: text("data").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const fileAssets = sqliteTable("file_assets", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  objectKey: text("object_key").notNull(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  size: real("size").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull(),
  budgetLineId: text("budget_line_id").notNull().default(""),
  expenseId: text("expense_id").notNull().default(""),
  vendor: text("vendor").notNull().default(""),
  amount: real("amount").notNull().default(0),
  spendDate: text("spend_date").notNull().default(""),
  memo: text("memo").notNull().default(""),
  createdAt: text("created_at").notNull(),
});

export const libraryFiles = sqliteTable("library_files", {
  id: text("id").primaryKey(),
  objectKey: text("object_key").notNull(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  size: real("size").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull().default(""),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("library_files_object_key_idx").on(table.objectKey), index("idx_library_files_category_created").on(table.category, table.createdAt)]);

export const budgetAudits = sqliteTable("budget_audits", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  source: text("source").notNull(),
  status: text("status").notNull(),
  summary: text("summary").notNull(),
  notes: text("notes").notNull(),
  createdAt: text("created_at").notNull(),
});

export const invoices = sqliteTable("invoices", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  kind: text("kind").notNull(),
  status: text("status").notNull(),
  issueDate: text("issue_date").notNull(),
  dueDate: text("due_date").notNull(),
  amount: real("amount").notNull(),
  paidAmount: real("paid_amount").notNull().default(0),
  description: text("description").notNull().default(""),
  terms: text("terms").notNull().default("Net 30"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_invoices_number_unique").on(table.invoiceNumber),
  index("idx_invoices_project_status").on(table.projectId, table.status),
]);

export const portalUsers = sqliteTable("portal_users", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  accessLevel: text("access_level").notNull(),
  active: real("active").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("portal_user_username_idx").on(table.username)]);

export const portalUserProjects = sqliteTable("portal_user_projects", {
  userId: text("user_id").notNull(),
  projectId: text("project_id").notNull(),
  permission: text("permission").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.projectId] })]);

export const portalAuthSettings = sqliteTable("portal_auth_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  createdAt: text("created_at").notNull(),
});
