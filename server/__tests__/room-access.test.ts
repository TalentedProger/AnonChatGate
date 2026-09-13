import { describe, expect, it } from 'vitest';
import { evaluateRoomAccess } from '../room-access';

describe('chat room access policy', () => {
  it('allows approved users with a completed profile into the global room', () => {
    expect(evaluateRoomAccess(
      { status: 'approved', profileCompleted: 'true' },
      { type: 'global' },
    )).toEqual({ allowed: true });
  });

  it.each(['pending', 'rejected'])(
    'rejects users with %s status',
    (status) => {
      expect(evaluateRoomAccess(
        { status, profileCompleted: 'true' },
        { type: 'global' },
      )).toMatchObject({ allowed: false, code: 'ACCOUNT_NOT_APPROVED' });
    },
  );

  it.each([null, 'false'])(
    'rejects an incomplete profile value of %s',
    (profileCompleted) => {
      expect(evaluateRoomAccess(
        { status: 'approved', profileCompleted },
        { type: 'global' },
      )).toMatchObject({ allowed: false, code: 'PROFILE_INCOMPLETE' });
    },
  );

  it('denies non-global rooms until explicit membership is implemented', () => {
    expect(evaluateRoomAccess(
      { status: 'approved', profileCompleted: 'true' },
      { type: 'private' },
    )).toMatchObject({ allowed: false, code: 'ROOM_ACCESS_DENIED' });
  });
});
