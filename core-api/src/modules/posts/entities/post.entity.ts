import { Comment } from 'src/modules/posts/comments/entities/comment.entity';
import { PrivacyType } from 'src/common/enums/privacy.enum';
import { SavePost } from 'src/modules/posts/bookmarks/save-posts/entities/save-post.entity';
import { User } from 'src/modules/users/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

import { Reaction } from 'src/modules/posts/reactions/entities/reaction.entity';
import { PostInteractions } from 'src/modules/posts/dto/post-interactions.dto';

@Entity()
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id: string;

  @Index()
  @Column('text', { default: null })
  content: string;

  @Index()
  @Column('text', { array: true, default: null })
  medias: string[];

  @Index()
  @Column('text', { array: true, default: '{}' })
  hashtags: string[];

  @Column('uuid', { array: true, default: () => "'{}'" })
  tagged_users: string[];

  @Column({ default: PrivacyType.PUBLIC, enum: PrivacyType })
  privacy: PrivacyType;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  shared_post_id: string;

  @Index()
  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @ManyToOne(() => User, (user) => user.posts)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Post, { nullable: true })
  @JoinColumn({ name: 'shared_post_id' })
  shared_post: Post;

  @OneToMany(() => SavePost, (savePost) => savePost.post)
  save_posts: SavePost[];

  @OneToMany(() => Comment, (comment) => comment.post)
  comments: Comment[];

  @OneToMany(() => Reaction, (reaction) => reaction.post)
  reactions: Reaction[];

  @ApiProperty({
    type: () => PostInteractions,
    description: 'Interaction counts',
  })
  interactions: PostInteractions;
}
