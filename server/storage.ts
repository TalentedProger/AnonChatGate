import { users, messages, rooms, type User, type InsertUser, type InsertProfile, type Message, type InsertMessage, type Room, type InsertRoom } from "@shared/schema";
import { db } from "./db";
import { eq, desc, lt, gt, and, sql } from "drizzle-orm";
import { MESSAGE } from "./config";

export interface PaginatedMessages {
  messages: (Message & { user: User | null })[];
  hasMore: boolean;
  nextCursor: number | null;
  prevCursor: number | null;
  totalCount?: number;
}

export interface IStorage {
  // User operations
  getUserById(id: number): Promise<User | undefined>;
  getUserByTgId(tgId: bigint): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserProfile(id: number, profile: InsertProfile): Promise<User | undefined>;
  markProfileCompleted(id: number): Promise<User | undefined>;

  // Message operations
  getMessagesByRoomId(roomId: number, limit?: number): Promise<(Message & { user: User | null })[]>;
  getMessagesPaginated(roomId: number, options: { limit?: number; cursor?: number; direction?: 'before' | 'after' }): Promise<PaginatedMessages>;
  getMessageById(id: number): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessageDelivery(messageId: number, deliveredTo: number[]): Promise<Message | undefined>;
  updateMessageRead(messageId: number, readBy: number[]): Promise<Message | undefined>;

  // Room operations
  getRoomById(id: number): Promise<Room | undefined>;
  createRoom(room: InsertRoom): Promise<Room>;
  getOrCreateGlobalRoom(): Promise<Room>;
}

export class DatabaseStorage implements IStorage {
  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByTgId(tgId: bigint): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.tgId, tgId));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Two-step process: insert user first, then update with auto-generated anonName
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    
    // Update with generated anonymous name based on user ID
    const [updatedUser] = await db
      .update(users)
      .set({ anonName: `Student_${user.id}` })
      .where(eq(users.id, user.id))
      .returning();
    
    return updatedUser;
  }


  async getMessagesByRoomId(roomId: number, limit: number = MESSAGE.DEFAULT_LIMIT): Promise<(Message & { user: User | null })[]> {
    const result = await db
      .select({
        id: messages.id,
        roomId: messages.roomId,
        userId: messages.userId,
        content: messages.content,
        deliveredTo: messages.deliveredTo,
        readBy: messages.readBy,
        createdAt: messages.createdAt,
        user: users,
      })
      .from(messages)
      .leftJoin(users, eq(messages.userId, users.id))
      .where(eq(messages.roomId, roomId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    return result.reverse();
  }

  async getMessagesPaginated(
    roomId: number, 
    options: { limit?: number; cursor?: number; direction?: 'before' | 'after' } = {}
  ): Promise<PaginatedMessages> {
    const { limit = MESSAGE.DEFAULT_LIMIT, cursor, direction = 'before' } = options;
    
    // Build the where condition
    let whereCondition = eq(messages.roomId, roomId);
    
    if (cursor) {
      if (direction === 'before') {
        // Get messages older than cursor (smaller IDs)
        whereCondition = and(eq(messages.roomId, roomId), lt(messages.id, cursor))!;
      } else {
        // Get messages newer than cursor (larger IDs)
        whereCondition = and(eq(messages.roomId, roomId), gt(messages.id, cursor))!;
      }
    }
    
    // Get messages with one extra to check if there are more
    const result = await db
      .select({
        id: messages.id,
        roomId: messages.roomId,
        userId: messages.userId,
        content: messages.content,
        deliveredTo: messages.deliveredTo,
        readBy: messages.readBy,
        createdAt: messages.createdAt,
        user: users,
      })
      .from(messages)
      .leftJoin(users, eq(messages.userId, users.id))
      .where(whereCondition)
      .orderBy(direction === 'before' ? desc(messages.id) : messages.id)
      .limit(limit + 1);
    
    // Check if there are more messages
    const hasMore = result.length > limit;
    const messageList = hasMore ? result.slice(0, limit) : result;
    
    // For 'before' direction, reverse to get chronological order
    if (direction === 'before') {
      messageList.reverse();
    }
    
    // Determine cursors
    const firstMessage = messageList[0];
    const lastMessage = messageList[messageList.length - 1];
    
    return {
      messages: messageList,
      hasMore,
      nextCursor: hasMore && direction === 'before' && firstMessage ? firstMessage.id : null,
      prevCursor: lastMessage ? lastMessage.id : null,
    };
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values(insertMessage)
      .returning();
    return message;
  }

  async getRoomById(id: number): Promise<Room | undefined> {
    const [room] = await db.select().from(rooms).where(eq(rooms.id, id));
    return room || undefined;
  }

  async createRoom(insertRoom: InsertRoom): Promise<Room> {
    const [room] = await db
      .insert(rooms)
      .values(insertRoom)
      .returning();
    return room;
  }

  async updateUserProfile(id: number, profile: InsertProfile): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(profile)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async markProfileCompleted(id: number): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ profileCompleted: "true" })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async getOrCreateGlobalRoom(): Promise<Room> {
    const [existingRoom] = await db.select().from(rooms).where(eq(rooms.name, "global"));
    if (existingRoom) {
      return existingRoom;
    }

    return await this.createRoom({
      name: "global",
      type: "global",
    });
  }

  async getMessageById(id: number): Promise<Message | undefined> {
    const [message] = await db.select().from(messages).where(eq(messages.id, id));
    return message || undefined;
  }

  async updateMessageDelivery(messageId: number, deliveredTo: number[]): Promise<Message | undefined> {
    const [message] = await db
      .update(messages)
      .set({ deliveredTo })
      .where(eq(messages.id, messageId))
      .returning();
    return message || undefined;
  }

  async updateMessageRead(messageId: number, readBy: number[]): Promise<Message | undefined> {
    const [message] = await db
      .update(messages)
      .set({ readBy })
      .where(eq(messages.id, messageId))
      .returning();
    return message || undefined;
  }
}

export const storage = new DatabaseStorage();
