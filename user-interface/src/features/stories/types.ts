export type StoryType = 'image' | 'video' | 'text';

export interface StoryAuthor {
  id: string;
  username: string;
  full_name?: string;
  avatar?: string;
}

export interface Story {
  id: string;
  user_id: string;
  type: StoryType;
  media_url: string | null;
  content: string | null;
  background: string | null;
  privacy: string;
  created_at: string;
  expires_at: string;
  is_viewed?: boolean;
}

export interface StoryGroup {
  user: StoryAuthor;
  stories: Story[];
  has_unseen: boolean;
}

export interface StoryViewer {
  id: string;
  username: string;
  full_name?: string;
  avatar?: string;
  viewed_at: string;
}
