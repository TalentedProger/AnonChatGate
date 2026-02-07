/**
 * Shared types for the client application
 * These types extend or adapt the shared schema types for client-side use
 */

import type { User as DbUser, Message as DbMessage, Room as DbRoom } from '@shared/schema';

// ============================================================================
// User Types
// ============================================================================

/**
 * Minimal user info displayed in chat messages
 */
export interface ChatUser {
  id: number;
  anonName: string;
}

/**
 * User with status information (for auth context)
 */
export interface AuthUser extends ChatUser {
  status: string;
}

/**
 * Full user profile
 */
export interface UserProfile extends AuthUser {
  displayName?: string | null;
  course?: string | null;
  direction?: string | null;
  bio?: string | null;
  gender?: string | null;
  avatarUrl?: string | null;
  socialLinks?: string[] | null;
  photos?: string[] | null;
  profileCompleted?: string | null;
  createdAt: Date | string;
}

// ============================================================================
// Message Types
// ============================================================================

/**
 * Chat message with user info
 */
export interface ChatMessage {
  id: number;
  content: string;
  createdAt: string;
  user: ChatUser | null;
  deliveredTo?: number[];
  readBy?: number[];
}

// ============================================================================
// Statistics Types
// ============================================================================

/**
 * User statistics for profile page
 */
export interface UserStatistics {
  popularity: number;
  views: number;
  friendRequests: number;
}

/**
 * Chat statistics
 */
export interface ChatStatistics {
  totalUsers: number;
  onlineCount: number;
  messagesCount?: number;
}

// ============================================================================
// News Types
// ============================================================================

/**
 * News item for the news feed
 */
export interface NewsItem {
  id: number;
  title: string;
  content: string;
  imageUrl?: string | null;
  authorId?: number | null;
  createdAt: string;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Standard API error response
 */
export interface ApiError {
  error: string;
  message?: string;
}

/**
 * Authentication response
 */
export interface AuthResponse {
  user: AuthUser;
  token: string;
  refreshToken: string;
  status: string;
}

/**
 * Messages response with pagination
 */
export interface MessagesResponse {
  messages: ChatMessage[];
  hasMore?: boolean;
  nextCursor?: number;
}

// ============================================================================
// WebSocket Types
// ============================================================================

/**
 * WebSocket message types
 */
export type WebSocketMessageType = 
  | 'connected'
  | 'message'
  | 'message_sent'
  | 'message_delivered'
  | 'message_read'
  | 'typing'
  | 'online_count'
  | 'error';

/**
 * Base WebSocket message structure
 */
export interface WebSocketMessage {
  type: WebSocketMessageType;
  [key: string]: unknown;
}

/**
 * Connected message
 */
export interface ConnectedMessage extends WebSocketMessage {
  type: 'connected';
  userId: number;
  roomId: number;
}

/**
 * Chat message from WebSocket
 */
export interface IncomingChatMessage extends WebSocketMessage {
  type: 'message';
  message: ChatMessage;
}

/**
 * Typing indicator message
 */
export interface TypingMessage extends WebSocketMessage {
  type: 'typing';
  userId: number;
  roomId: number;
}

/**
 * Online count message
 */
export interface OnlineCountMessage extends WebSocketMessage {
  type: 'online_count';
  count: number;
}
