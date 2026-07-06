export interface BasicUser {
  full_name?: string;
  username?: string;
  email?: string;
  avatar?: string;
  avatarUrl?: string;
  profile_picture_url?: string;
  profilePicture?: string;
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

export function getUserAvatarUrl(user?: BasicUser | null): string {
  return getAvatarUrl(
    user?.avatar || user?.avatarUrl || user?.profile_picture_url || user?.profilePicture,
  );
}

export function getGroupAvatarUrl(avatar?: string | null): string {
  if (!avatar || avatar === 'chat-room.png') return '/default-group-avatar.jpg';
  return avatar;
}
