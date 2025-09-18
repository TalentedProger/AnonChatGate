import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, bigint, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  tgId: bigint("tg_id", { mode: "bigint" }).unique(),
  username: text("username"),
  anonName: text("anon_name"),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  // Profile fields
  displayName: text("display_name").unique(),
  course: text("course", { enum: ["1", "2", "3", "4", "5", "6"] }),
  direction: text("direction"),
  bio: text("bio"),
  gender: text("gender", { enum: ["male", "female"] }),
  avatarUrl: text("avatar_url"),
  socialLinks: text("social_links").array(),
  photos: text("photos").array(),
  profileCompleted: text("profile_completed", { enum: ["true", "false"] }).default("false"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rooms = pgTable("rooms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("global"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").references(() => rooms.id).notNull(),
  userId: integer("user_id").references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  messages: many(messages),
}));

export const roomsRelations = relations(rooms, ({ many }) => ({
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  user: one(users, {
    fields: [messages.userId],
    references: [users.id],
  }),
  room: one(rooms, {
    fields: [messages.roomId],
    references: [rooms.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  anonName: true, // Will be auto-generated based on user ID
});

// Username validation schema
export const usernameSchema = z.string()
  .min(3, "Имя пользователя должно содержать минимум 3 символа")
  .max(32, "Имя пользователя должно содержать максимум 32 символа")
  .regex(/^[A-Za-z0-9_-]+$/, "Имя пользователя может содержать только латинские буквы, цифры, _ и -");

export const insertProfileSchema = createInsertSchema(users).pick({
  displayName: true,
  course: true, 
  direction: true,
  bio: true,
  gender: true,
  avatarUrl: true,
  socialLinks: true,
  photos: true,
}).extend({
  displayName: usernameSchema,
  course: z.enum(["1", "2", "3", "4", "5", "6"], { required_error: "Курс обязателен" }),
  direction: z.string().min(1, "Направление обязательно"),
  bio: z.string().optional(),
  gender: z.enum(["male", "female"], { required_error: "Пол обязателен" }),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  socialLinks: z.array(z.string().url()).optional(),
  photos: z.array(z.string().url()).optional(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export const insertRoomSchema = createInsertSchema(rooms).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type User = typeof users.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Room = typeof rooms.$inferSelect;
