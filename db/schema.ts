import { primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

export const budgetAudits = sqliteTable("budget_audits", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  source: text("source").notNull(),
  status: text("status").notNull(),
  summary: text("summary").notNull(),
  notes: text("notes").notNull(),
  createdAt: text("created_at").notNull(),
});

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
