import { Request, Response } from 'express';
import { db } from './db';
import { users, profileViews, friendRequests, messages, rooms, news } from '@shared/schema';
import { eq, desc, sql, and, ne } from 'drizzle-orm';
import { getOnlineUsersCount } from './websocket';
import { logger } from './logger';

// Extend Express Request type to include user
interface AuthRequest extends Request {
  user?: {
    id: number;
    userId: number;
  };
}

// Get user statistics (popularity, friend requests count)
export async function getUserStatistics(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Count unique profile views (popularity)
    const popularityResult = await db
      .select({ count: sql<number>`count(distinct viewer_user_id)` })
      .from(profileViews)
      .where(eq(profileViews.profileUserId, userId));
    
    const popularity = popularityResult[0]?.count || 0;

    // Count incoming friend requests (all statuses for now)
    const friendRequestsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(friendRequests)
      .where(eq(friendRequests.toUserId, userId));
    
    const friendRequestsCount = friendRequestsResult[0]?.count || 0;

    return res.json({
      popularity: Number(popularity),
      friendRequests: Number(friendRequestsCount),
    });
  } catch (error) {
    logger.error({ error }, '[Statistics] Error getting user statistics');
    return res.status(500).json({ error: 'Failed to get statistics' });
  }
}

// Record a profile view
export async function recordProfileView(req: AuthRequest, res: Response) {
  try {
    const viewerUserId = req.user?.id;
    const { profileUserId } = req.body;

    if (!viewerUserId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!profileUserId || profileUserId === viewerUserId) {
      // Don't record views of own profile
      return res.status(200).json({ message: 'View not recorded' });
    }

    // Try to insert, ignore if duplicate (already viewed)
    await db
      .insert(profileViews)
      .values({
        profileUserId,
        viewerUserId,
      })
      .onConflictDoNothing();

    return res.status(200).json({ message: 'View recorded' });
  } catch (error) {
    logger.error({ error }, '[Statistics] Error recording profile view');
    return res.status(500).json({ error: 'Failed to record view' });
  }
}

// Get chat statistics (total users, online users)
export async function getChatStatistics(req: Request, res: Response) {
  try {
    const { roomId } = req.params;

    // Get total users count
    const totalUsersResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.status, 'approved'));
    
    const totalUsers = totalUsersResult[0]?.count || 0;

    // Get online users from WebSocket connections
    const onlineUsers = getOnlineUsersCount();

    return res.json({
      totalUsers: Number(totalUsers),
      onlineUsers: onlineUsers,
    });
  } catch (error) {
    logger.error({ error }, '[Statistics] Error getting chat statistics');
    return res.status(500).json({ error: 'Failed to get chat statistics' });
  }
}

// Get last message in room
export async function getLastMessage(req: Request, res: Response) {
  try {
    const { roomId } = req.params;

    const lastMessageResult = await db
      .select({
        id: messages.id,
        content: messages.content,
        createdAt: messages.createdAt,
        userId: messages.userId,
        anonName: users.anonName,
      })
      .from(messages)
      .leftJoin(users, eq(messages.userId, users.id))
      .where(eq(messages.roomId, parseInt(roomId)))
      .orderBy(desc(messages.createdAt))
      .limit(1);

    if (lastMessageResult.length === 0) {
      return res.json({ lastMessage: null });
    }

    return res.json({ lastMessage: lastMessageResult[0] });
  } catch (error) {
    logger.error({ error }, '[Statistics] Error getting last message');
    return res.status(500).json({ error: 'Failed to get last message' });
  }
}

// Get top popular users
export async function getTopPopularUsers(req: Request, res: Response) {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    // Get users with their view counts, ordered by popularity
    const topUsers = await db
      .select({
        userId: users.id,
        anonName: users.anonName,
        popularity: sql<number>`count(distinct ${profileViews.viewerUserId})`,
      })
      .from(users)
      .leftJoin(profileViews, eq(users.id, profileViews.profileUserId))
      .where(eq(users.status, 'approved'))
      .groupBy(users.id, users.anonName)
      .orderBy(desc(sql`count(distinct ${profileViews.viewerUserId})`))
      .limit(limit);

    return res.json({ topUsers });
  } catch (error) {
    logger.error({ error }, '[Statistics] Error getting top users');
    return res.status(500).json({ error: 'Failed to get top users' });
  }
}

// Get news feed
export async function getNewsFeed(req: Request, res: Response) {
  try {
    const limit = parseInt(req.query.limit as string) || 5;

    const newsFeed = await db
      .select({
        id: news.id,
        title: news.title,
        content: news.content,
        imageUrl: news.imageUrl,
        createdAt: news.createdAt,
        authorName: users.anonName,
      })
      .from(news)
      .leftJoin(users, eq(news.authorId, users.id))
      .orderBy(desc(news.createdAt))
      .limit(limit);

    return res.json({ news: newsFeed });
  } catch (error) {
    logger.error({ error }, '[Statistics] Error getting news feed');
    return res.status(500).json({ error: 'Failed to get news feed' });
  }
}

// Create news item (admin only for now)
export async function createNewsItem(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const { title, content, imageUrl } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const [newsItem] = await db
      .insert(news)
      .values({
        title,
        content,
        imageUrl: imageUrl || null,
        authorId: userId,
      })
      .returning();

    return res.status(201).json({ news: newsItem });
  } catch (error) {
    logger.error({ error }, '[Statistics] Error creating news item');
    return res.status(500).json({ error: 'Failed to create news item' });
  }
}
