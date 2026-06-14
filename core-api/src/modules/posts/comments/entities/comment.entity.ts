import { Post } from 'src/modules/posts/entities/post.entity';
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
import { Reaction } from 'src/modules/posts/reactions/entities/reaction.entity';
import { ApiProperty } from '@nestjs/swagger';
import { CommentInteractions } from 'src/modules/posts/comments/dto/comment-interactions.dto';

@Entity()
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  user_id: string;

  @Column()
  @Index()
  post_id: string;

  @Index()
  @Column()
  content: string;

  @Index()
  @Column('text', { array: true, default: null })
  medias: string[];

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @Column({ nullable: true })
  @Index()
  parent_id: string;

  @Column('text', { array: true, nullable: true })
  tagged_users: string[];

  /** Ẩn do hành động chặn (block sweep). Không khôi phục khi unblock. */
  @Index()
  @Column({ default: false })
  is_hidden: boolean;

  @ManyToOne(() => User, (user) => user.comments)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Post, (post) => post.comments)
  @JoinColumn({ name: 'post_id' })
  post: Post;

  @ManyToOne(() => Comment, (comment) => comment.childComments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parent_id' })
  parentComment: Comment;

  @OneToMany(() => Comment, (comment) => comment.parentComment)
  childComments: Comment[];

  @OneToMany(() => Reaction, (reaction) => reaction.comment)
  reactions: Reaction[];

  @ApiProperty({
    type: () => CommentInteractions,
    description: 'Interaction counts',
  })
  interactions: CommentInteractions;
}
