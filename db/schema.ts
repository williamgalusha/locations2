import { real, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
});

export const budgetLines = sqliteTable("budget_lines", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  estimate: real("estimate").notNull(),
  actual: real("actual").notNull(),
  createdAt: text("created_at").notNull(),
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
  createdAt: text("created_at").notNull(),
});
