import type { UserRole, UserStatus } from '@/shared/api/types';

/**
 * Wire values for the users screens, shared by the list and the detail page.
 *
 * Both files spelled these out for themselves, so the role dropdown on one and
 * the role dropdown on the other could — and did — disagree: AGENT existed on
 * the backend while neither list offered it. One array now feeds the filter,
 * the edit modal and every label, which is one edit for the next role instead
 * of a hunt for the copies.
 */

/** Every role the backend's enum holds, signup roles first, then staff. */
export const USER_ROLES: UserRole[] = [
  'STUDENT',
  'TENANT',
  'OWNER',
  'AGENT',
  'MODERATOR',
  'ADMIN',
  'DEVELOPER',
];

export const USER_STATUSES: UserStatus[] = [
  'PENDING_VERIFICATION',
  'ACTIVE',
  'SUSPENDED',
  'BANNED',
  'REGISTRATION_REQUIRED',
];
