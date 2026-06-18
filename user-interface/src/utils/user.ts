export interface BasicUser {
  full_name?: string;
  username?: string;
  email?: string;
  avatar?: string;
  [key: string]: any;
}

/**
 * Returns the full name if available, otherwise falls back to username.
 * If neither is available, falls back to a default string or email.
 */
export function getDisplayName(user?: BasicUser | null, fallback = 'Người dùng'): string {
  if (!user) return fallback;
  return user.full_name || user.username || user.email || fallback;
}

/**
 * Returns the avatar URL if available, otherwise falls back to the default avatar.
 */
export function getAvatarUrl(avatar?: string | null): string {
  if (!avatar) return '/default-avatar.png';
  return avatar;
}
