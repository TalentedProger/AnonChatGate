import { users, messages, rooms, favorites, friendRequests, authSessions, type User, type InsertUser, type InsertProfile, type Message, type InsertMessage, type Room, type InsertRoom, type Favorite, type InsertFavorite, type FriendRequest, type InsertFriendRequest, type AuthSession, type InsertAuthSession } from "@shared/schema";
import { db } from "./db";
import { eq, desc, lt, gt, and, sql, ne, isNull } from "drizzle-orm";
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
  updateUser(id: number, data: Partial<User>): Promise<User | undefined>;
  updateUserProfile(id: number, profile: InsertProfile): Promise<User | undefined>;
  markProfileCompleted(id: number): Promise<User | undefined>;

  // Authentication session operations
  createAuthSession(session: InsertAuthSession): Promise<AuthSession>;
  rotateAuthSession(input: {
    sessionId: string;
    userId: number;
    previousTokenHash: string;
    previousTokenId: string;
    nextTokenHash: string;
    nextTokenId: string;
  }): Promise<AuthSession | undefined>;
  revokeAuthSession(sessionId: string, userId: number, tokenHash: string): Promise<boolean>;

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
  
  // Favorites operations
  getUserFavorites(userId: number): Promise<(Favorite & { favoriteUser: User })[]>;
  getFavoriteByMonth(userId: number, monthKey: string): Promise<Favorite | undefined>;
  addFavorite(favorite: InsertFavorite): Promise<Favorite>;
  removeFavorite(userId: number, favoriteUserId: number): Promise<void>;
  isFavorite(userId: number, favoriteUserId: number): Promise<boolean>;
  
  // Popularity - count how many times a user is in someone's favorites (current month)
  getUserPopularity(userId: number, monthKey: string): Promise<number>;
  
  // Friend requests operations (notifications system)
  getPendingRequestsForUser(userId: number): Promise<(FriendRequest & { fromUser: User })[]>;
  getFriendRequestByMonth(fromUserId: number, toUserId: number, monthKey: string): Promise<FriendRequest | undefined>;
  createFriendRequest(request: InsertFriendRequest): Promise<FriendRequest>;
  updateFriendRequestStatus(requestId: number, status: 'accepted' | 'rejected'): Promise<FriendRequest | undefined>;
  getAcceptedRequestsForUser(userId: number): Promise<(FriendRequest & { fromUser: User })[]>;
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
        replyToId: messages.replyToId,
        replyToAnonName: messages.replyToAnonName,
        replyToContent: messages.replyToContent,
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
        replyToId: messages.replyToId,
        replyToAnonName: messages.replyToAnonName,
        replyToContent: messages.replyToContent,
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

  async updateUser(id: number, data: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(data)
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

  async createAuthSession(session: InsertAuthSession): Promise<AuthSession> {
    const [createdSession] = await db
      .insert(authSessions)
      .values(session)
      .returning();

    return createdSession;
  }

  async rotateAuthSession(input: {
    sessionId: string;
    userId: number;
    previousTokenHash: string;
    previousTokenId: string;
    nextTokenHash: string;
    nextTokenId: string;
  }): Promise<AuthSession | undefined> {
    const [rotatedSession] = await db
      .update(authSessions)
      .set({
        refreshTokenHash: input.nextTokenHash,
        refreshTokenJti: input.nextTokenId,
        updatedAt: new Date(),
      })
      .where(and(
        eq(authSessions.id, input.sessionId),
        eq(authSessions.userId, input.userId),
        eq(authSessions.refreshTokenHash, input.previousTokenHash),
        eq(authSessions.refreshTokenJti, input.previousTokenId),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, new Date()),
      ))
      .returning();

    return rotatedSession || undefined;
  }

  async revokeAuthSession(sessionId: string, userId: number, tokenHash: string): Promise<boolean> {
    const [revokedSession] = await db
      .update(authSessions)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq(authSessions.id, sessionId),
        eq(authSessions.userId, userId),
        eq(authSessions.refreshTokenHash, tokenHash),
        isNull(authSessions.revokedAt),
      ))
      .returning({ id: authSessions.id });

    return Boolean(revokedSession);
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

  // Favorites operations
  async getUserFavorites(userId: number): Promise<(Favorite & { favoriteUser: User })[]> {
    const result = await db
      .select()
      .from(favorites)
      .innerJoin(users, eq(favorites.favoriteUserId, users.id))
      .where(eq(favorites.userId, userId))
      .orderBy(desc(favorites.createdAt));
    
    return result.map(row => ({
      ...row.favorites,
      favoriteUser: row.users
    }));
  }

  async getFavoriteByMonth(userId: number, monthKey: string): Promise<Favorite | undefined> {
    const [favorite] = await db
      .select()
      .from(favorites)
      .where(and(
        eq(favorites.userId, userId),
        eq(favorites.monthKey, monthKey)
      ));
    return favorite || undefined;
  }

  async addFavorite(insertFavorite: InsertFavorite): Promise<Favorite> {
    const [favorite] = await db
      .insert(favorites)
      .values(insertFavorite)
      .returning();
    return favorite;
  }

  async removeFavorite(userId: number, favoriteUserId: number): Promise<void> {
    await db
      .delete(favorites)
      .where(and(
        eq(favorites.userId, userId),
        eq(favorites.favoriteUserId, favoriteUserId)
      ));
  }

  async isFavorite(userId: number, favoriteUserId: number): Promise<boolean> {
    const [favorite] = await db
      .select()
      .from(favorites)
      .where(and(
        eq(favorites.userId, userId),
        eq(favorites.favoriteUserId, favoriteUserId)
      ));
    return !!favorite;
  }

  // Get popularity - count how many times a user is favorited in current month
  async getUserPopularity(userId: number, monthKey: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(favorites)
      .where(and(
        eq(favorites.favoriteUserId, userId),
        eq(favorites.monthKey, monthKey)
      ));
    return Number(result[0]?.count || 0);
  }

  // Friend requests operations
  async getPendingRequestsForUser(userId: number): Promise<(FriendRequest & { fromUser: User })[]> {
    const result = await db
      .select()
      .from(friendRequests)
      .innerJoin(users, eq(friendRequests.fromUserId, users.id))
      .where(and(
        eq(friendRequests.toUserId, userId),
        eq(friendRequests.status, 'pending')
      ))
      .orderBy(desc(friendRequests.createdAt));
    
    return result.map(row => ({
      ...row.friend_requests,
      fromUser: row.users
    }));
  }

  async getFriendRequestByMonth(fromUserId: number, toUserId: number, monthKey: string): Promise<FriendRequest | undefined> {
    const [request] = await db
      .select()
      .from(friendRequests)
      .where(and(
        eq(friendRequests.fromUserId, fromUserId),
        eq(friendRequests.toUserId, toUserId),
        eq(friendRequests.monthKey, monthKey)
      ));
    return request || undefined;
  }

  async createFriendRequest(request: InsertFriendRequest): Promise<FriendRequest> {
    const [friendRequest] = await db
      .insert(friendRequests)
      .values(request)
      .returning();
    return friendRequest;
  }

  async updateFriendRequestStatus(requestId: number, status: 'accepted' | 'rejected'): Promise<FriendRequest | undefined> {
    const [request] = await db
      .update(friendRequests)
      .set({ 
        status, 
        respondedAt: new Date() 
      })
      .where(eq(friendRequests.id, requestId))
      .returning();
    return request || undefined;
  }

  async getAcceptedRequestsForUser(userId: number): Promise<(FriendRequest & { fromUser: User })[]> {
    const result = await db
      .select()
      .from(friendRequests)
      .innerJoin(users, eq(friendRequests.fromUserId, users.id))
      .where(and(
        eq(friendRequests.toUserId, userId),
        eq(friendRequests.status, 'accepted')
      ))
      .orderBy(desc(friendRequests.respondedAt));
    
    return result.map(row => ({
      ...row.friend_requests,
      fromUser: row.users
    }));
  }
}

export const storage = new DatabaseStorage();
