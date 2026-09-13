import type { Room, User } from '@shared/schema';

type ChatUser = Pick<User, 'status' | 'profileCompleted'>;
type ChatRoom = Pick<Room, 'type'>;

export type RoomAccessDecision =
  | { allowed: true }
  | {
      allowed: false;
      status: 403;
      code: 'ACCOUNT_NOT_APPROVED' | 'PROFILE_INCOMPLETE' | 'ROOM_ACCESS_DENIED';
      message: string;
    };

/**
 * Current membership policy for the MVP.
 * Every approved user with a completed profile belongs to the global room.
 * All other room types are denied until explicit room memberships exist.
 */
export function evaluateRoomAccess(user: ChatUser, room: ChatRoom): RoomAccessDecision {
  if (user.status !== 'approved') {
    return {
      allowed: false,
      status: 403,
      code: 'ACCOUNT_NOT_APPROVED',
      message: 'Account is not approved for chat access',
    };
  }

  if (user.profileCompleted !== 'true') {
    return {
      allowed: false,
      status: 403,
      code: 'PROFILE_INCOMPLETE',
      message: 'Complete your profile before accessing the chat',
    };
  }

  if (room.type !== 'global') {
    return {
      allowed: false,
      status: 403,
      code: 'ROOM_ACCESS_DENIED',
      message: 'You are not a member of this room',
    };
  }

  return { allowed: true };
}
