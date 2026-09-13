import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, bigint, serial, integer, uuid, index, uniqueIndex, check, type AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  tgId: bigint("tg_id", { mode: "bigint" }).unique(),
  username: text("username"),
  anonName: text("anon_name"),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("approved"),
  // Profile fields
  displayName: text("display_name").unique(),
  course: text("course", { enum: ["1", "2", "3", "4", "5", "6"] }),
  direction: text("direction"),
  bio: text("bio"),
  gender: text("gender", { enum: ["male", "female"] }),
  avatarUrl: text("avatar_url"),
  telegramPhotoUrl: text("telegram_photo_url"), // Real Telegram avatar URL
  socialLinks: text("social_links").array(),
  photos: text("photos").array(),
  profileCompleted: text("profile_completed", { enum: ["true", "false"] }).default("false"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("ux_users_display_name_lower").on(sql`lower(${table.displayName})`).where(sql`${table.displayName} IS NOT NULL`),
  check("users_status_check", sql`${table.status} IN ('pending', 'approved', 'rejected')`),
  check("users_course_check", sql`${table.course} IS NULL OR ${table.course} IN ('1', '2', '3', '4', '5', '6')`),
  check("users_gender_check", sql`${table.gender} IS NULL OR ${table.gender} IN ('male', 'female')`),
  check("users_profile_completed_check", sql`${table.profileCompleted} IS NULL OR ${table.profileCompleted} IN ('true', 'false')`),
]);

export const authSessions = pgTable("auth_sessions", {
  id: uuid("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  refreshTokenHash: varchar("refresh_token_hash", { length: 64 }).notNull().unique(),
  refreshTokenJti: uuid("refresh_token_jti").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_auth_sessions_user_id").on(table.userId),
  index("idx_auth_sessions_expires_at").on(table.expiresAt),
  index("idx_auth_sessions_active_user").on(table.userId).where(sql`${table.revokedAt} IS NULL`),
]);

export const rooms = pgTable("rooms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("global"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_rooms_name").on(table.name),
  uniqueIndex("ux_rooms_single_global").on(table.type).where(sql`${table.type} = 'global'`),
]);

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").references(() => rooms.id).notNull(),
  userId: integer("user_id").references(() => users.id),
  content: text("content").notNull(),
  // Reply fields - stored separately, not embedded in content
  replyToId: integer("reply_to_id").references((): AnyPgColumn => messages.id, { onDelete: "set null" }),
  replyToAnonName: text("reply_to_anon_name"),   // Name of user who wrote the replied message
  replyToContent: text("reply_to_content"),      // Truncated content of replied message
  deliveredTo: integer("delivered_to").array(),  // Array of user IDs who received the message
  readBy: integer("read_by").array(),            // Array of user IDs who read the message
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_messages_room_created").on(table.roomId, table.createdAt),
  index("idx_messages_user").on(table.userId),
  index("idx_messages_reply_to_id").on(table.replyToId),
  index("idx_messages_delivered_to").using("gin", table.deliveredTo),
  index("idx_messages_read_by").using("gin", table.readBy),
]);

export const profileViews = pgTable("profile_views", {
  id: serial("id").primaryKey(),
  profileUserId: integer("profile_user_id").references(() => users.id).notNull(), // Whose profile was viewed
  viewerUserId: integer("viewer_user_id").references(() => users.id).notNull(),   // Who viewed the profile
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("ux_profile_views_users").on(table.profileUserId, table.viewerUserId),
  index("idx_profile_views_profile_user").on(table.profileUserId),
  index("idx_profile_views_viewer_user").on(table.viewerUserId),
]);

export const friendRequests = pgTable("friend_requests", {
  id: serial("id").primaryKey(),
  fromUserId: integer("from_user_id").references(() => users.id).notNull(),
  toUserId: integer("to_user_id").references(() => users.id).notNull(),
  status: text("status", { enum: ["pending", "accepted", "rejected"] }).notNull().default("pending"),
  monthKey: text("month_key").notNull(), // Format: "2025-01" - requests are sent at month end
  createdAt: timestamp("created_at").defaultNow().notNull(),
  respondedAt: timestamp("responded_at"),
}, (table) => [
  uniqueIndex("ux_friend_requests_users_month").on(table.fromUserId, table.toUserId, table.monthKey),
  index("idx_friend_requests_to_user_status").on(table.toUserId, table.status),
  index("idx_friend_requests_month").on(table.monthKey),
  index("idx_friend_requests_from_user").on(table.fromUserId),
  check("friend_requests_status_check", sql`${table.status} IN ('pending', 'accepted', 'rejected')`),
  check("friend_requests_month_key_check", sql`${table.monthKey} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
]);

export const news = pgTable("news", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  authorId: integer("author_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_news_created_at").on(table.createdAt),
]);

// Favorites table - users can add 1 favorite per month
export const favorites = pgTable("favorites", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),           // Who added the favorite
  favoriteUserId: integer("favorite_user_id").references(() => users.id).notNull(), // Who is favorited
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Track the month this was set for the 1/month limit
  monthKey: text("month_key").notNull(), // Format: "2025-01" - allows only 1 favorite per month
}, (table) => [
  uniqueIndex("ux_favorites_user_month").on(table.userId, table.monthKey),
  index("idx_favorites_user_id").on(table.userId),
  index("idx_favorites_favorite_user_id").on(table.favoriteUserId),
  check("favorites_month_key_check", sql`${table.monthKey} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
]);

export const usersRelations = relations(users, ({ many }) => ({
  messages: many(messages),
  authSessions: many(authSessions),
}));

export const authSessionsRelations = relations(authSessions, ({ one }) => ({
  user: one(users, {
    fields: [authSessions.userId],
    references: [users.id],
  }),
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
  socialLinks: z.array(z.string()).optional(),
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

export const insertFavoriteSchema = createInsertSchema(favorites).omit({
  id: true,
  createdAt: true,
});

export const insertFriendRequestSchema = createInsertSchema(friendRequests).omit({
  id: true,
  createdAt: true,
  respondedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type User = typeof users.$inferSelect;
export type AuthSession = typeof authSessions.$inferSelect;
export type InsertAuthSession = typeof authSessions.$inferInsert;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Room = typeof rooms.$inferSelect;
export type Favorite = typeof favorites.$inferSelect;
export type FriendRequest = typeof friendRequests.$inferSelect;
export type InsertFriendRequest = z.infer<typeof insertFriendRequestSchema>;
export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
