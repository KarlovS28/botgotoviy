import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Role enumeration
export const ROLES = {
  SYSADMIN: "sysadmin",
  ACCOUNTANT: "accountant",
  MANAGER: "manager",
  EMPLOYEE: "employee",
  ADMIN: "admin"
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// Chat types
export const CHAT_TYPES = {
  EQUIPMENT: "equipment",
  PASSWORDS: "passwords",
  TASKS: "tasks"
} as const;

export type ChatType = (typeof CHAT_TYPES)[keyof typeof CHAT_TYPES];

// Equipment status
export const EQUIPMENT_STATUS = {
  ACTIVE: "active",
  STORAGE: "storage",
  REPAIR: "repair",
  DECOMMISSIONED: "decommissioned",
  WRITTEN_OFF: "written_off"
} as const;

export type EquipmentStatus = (typeof EQUIPMENT_STATUS)[keyof typeof EQUIPMENT_STATUS];

// Task status
export const TASK_STATUS = {
  NEW: "new",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  URGENT: "urgent"
} as const;

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  telegramId: text("telegram_id").notNull().unique(),
  username: text("username"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  role: text("role").notNull().default(ROLES.EMPLOYEE),
  isAdmin: boolean("is_admin").default(false),
  isRegistered: boolean("is_registered").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Access permissions
export const permissions = pgTable("permissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  chatType: text("chat_type").notNull(),
  hasAccess: boolean("has_access").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Equipment table
export const equipment = pgTable("equipment", {
  id: serial("id").primaryKey(),
  inventoryNumber: text("inventory_number").notNull().unique(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull().default(EQUIPMENT_STATUS.STORAGE),
  assignedToUserId: integer("assigned_to_user_id").references(() => users.id),
  description: text("description"),
  department: text("department"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Equipment history
export const equipmentHistory = pgTable("equipment_history", {
  id: serial("id").primaryKey(),
  equipmentId: integer("equipment_id").references(() => equipment.id).notNull(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  details: text("details"),
  timestamp: timestamp("timestamp").defaultNow().notNull()
});

// Secure passwords
export const securePasswords = pgTable("secure_passwords", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").references(() => users.id).notNull(),
  receiverId: integer("receiver_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  type: text("type").notNull(),
  encryptedContent: text("encrypted_content").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Tasks
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  createdByUserId: integer("created_by_user_id").references(() => users.id).notNull(),
  assignedToUserId: integer("assigned_to_user_id").references(() => users.id),
  status: text("status").notNull().default(TASK_STATUS.NEW),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Task comments
export const taskComments = pgTable("task_comments", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => tasks.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Bot settings
export const botSettings = pgTable("bot_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: jsonb("value"),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Relations

export const usersRelations = relations(users, ({ many }) => ({
  permissions: many(permissions),
  assignedEquipment: many(equipment, { relationName: "assigned_equipment" }),
  securePasswordsSent: many(securePasswords, { relationName: "passwords_sent" }),
  securePasswordsReceived: many(securePasswords, { relationName: "passwords_received" }),
  createdTasks: many(tasks, { relationName: "created_tasks" }),
  assignedTasks: many(tasks, { relationName: "assigned_tasks" }),
  taskComments: many(taskComments)
}));

export const permissionsRelations = relations(permissions, ({ one }) => ({
  user: one(users, { fields: [permissions.userId], references: [users.id] })
}));

export const equipmentRelations = relations(equipment, ({ one, many }) => ({
  assignedUser: one(users, { fields: [equipment.assignedToUserId], references: [users.id], relationName: "assigned_equipment" }),
  history: many(equipmentHistory)
}));

export const equipmentHistoryRelations = relations(equipmentHistory, ({ one }) => ({
  equipment: one(equipment, { fields: [equipmentHistory.equipmentId], references: [equipment.id] }),
  user: one(users, { fields: [equipmentHistory.userId], references: [users.id] })
}));

export const securePasswordsRelations = relations(securePasswords, ({ one }) => ({
  sender: one(users, { fields: [securePasswords.senderId], references: [users.id], relationName: "passwords_sent" }),
  receiver: one(users, { fields: [securePasswords.receiverId], references: [users.id], relationName: "passwords_received" })
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  createdBy: one(users, { fields: [tasks.createdByUserId], references: [users.id], relationName: "created_tasks" }),
  assignedTo: one(users, { fields: [tasks.assignedToUserId], references: [users.id], relationName: "assigned_tasks" }),
  comments: many(taskComments)
}));

export const taskCommentsRelations = relations(taskComments, ({ one }) => ({
  task: one(tasks, { fields: [taskComments.taskId], references: [tasks.id] }),
  user: one(users, { fields: [taskComments.userId], references: [users.id] })
}));

// Schemas for inserts with validation

export const userInsertSchema = createInsertSchema(users, {
  role: (schema) => z.enum([ROLES.SYSADMIN, ROLES.ACCOUNTANT, ROLES.MANAGER, ROLES.EMPLOYEE, ROLES.ADMIN])
});

export const permissionInsertSchema = createInsertSchema(permissions, {
  chatType: (schema) => z.enum([CHAT_TYPES.EQUIPMENT, CHAT_TYPES.PASSWORDS, CHAT_TYPES.TASKS])
});

export const equipmentInsertSchema = createInsertSchema(equipment, {
  status: (schema) => z.enum([EQUIPMENT_STATUS.ACTIVE, EQUIPMENT_STATUS.STORAGE, EQUIPMENT_STATUS.REPAIR, EQUIPMENT_STATUS.DECOMMISSIONED]),

  inventoryNumber: (schema) => schema.min(1, "Инвентарный номер обязателен"),
  name: (schema) => schema.min(1, "Название обязательно"),
  type: (schema) => schema.min(1, "Тип обязателен")
});

export const taskInsertSchema = createInsertSchema(tasks, {
  status: (schema) => z.enum([TASK_STATUS.NEW, TASK_STATUS.IN_PROGRESS, TASK_STATUS.COMPLETED, TASK_STATUS.URGENT]),

  title: (schema) => schema.min(1, "Название задачи обязательно")
});

export const securePasswordInsertSchema = createInsertSchema(securePasswords, {
  title: (schema) => schema.min(1, "Название обязательно"),
  encryptedContent: (schema) => schema.min(1, "Контент обязателен")
});

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof userInsertSchema>;

export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = z.infer<typeof permissionInsertSchema>;

export type Equipment = typeof equipment.$inferSelect;
export type InsertEquipment = z.infer<typeof equipmentInsertSchema>;

export type EquipmentHistory = typeof equipmentHistory.$inferSelect;

export type SecurePassword = typeof securePasswords.$inferSelect;
export type InsertSecurePassword = z.infer<typeof securePasswordInsertSchema>;

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof taskInsertSchema>;

export type TaskComment = typeof taskComments.$inferSelect;

export type BotSetting = typeof botSettings.$inferSelect;
