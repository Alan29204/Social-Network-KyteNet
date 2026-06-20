import { ReactionType } from 'src/common/enums/reaction.enum';
import { Post } from 'src/modules/posts/entities/post.entity';
import { Comment } from 'src/modules/posts/comments/entities/comment.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class Reaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  post_id: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  comment_id: string;

  @Column({ enum: ReactionType, default: ReactionType.LIKE })
  reaction: ReactionType;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  /** Ẩn do hành động chặn (block sweep). Không khôi phục khi unblock. */
  @Index()
  @Column({ default: false })
  is_hidden: boolean;

  @ManyToOne(() => Post, (post) => post.reactions)
  @JoinColumn({ name: 'post_id' })
  post: Post;

  @ManyToOne(() => Comment, (comment) => comment.reactions)
  @JoinColumn({ name: 'comment_id' })
  comment: Comment;
}
