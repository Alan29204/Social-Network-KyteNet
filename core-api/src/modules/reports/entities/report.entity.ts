import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from 'src/modules/users/entities/user.entity';
import { Post } from 'src/modules/posts/entities/post.entity';
import { ChatMessage } from 'src/modules/chats/entities/chat-message.entity';
import { Comment } from 'src/modules/posts/comments/entities/comment.entity';

export enum ReportType {
  POST = 'post',
  USER = 'user',
  MESSAGE = 'message',
  COMMENT = 'comment',
}

export enum ReportReason {
  SPAM = 'spam',
  VIOLENCE = 'violence',
  ADULT_CONTENT = 'adult_content',
  HARASSMENT = 'harassment',
  FAKE_INFO = 'fake_info',
  OTHER = 'other',
}

export enum ReportStatus {
  PENDING = 'pending',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
}

export enum ReportAction {
  NO_ACTION = 'no_action',
  WARN_REPORTED = 'warn_reported',
  REMOVE_POST = 'remove_post',
  REMOVE_COMMENT = 'remove_comment',
  LOCK_USER = 'lock_user',
}

@Entity()
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ReportType })
  type: ReportType;

  @Column({ type: 'enum', enum: ReportReason })
  reason: ReportReason;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.PENDING })
  status: ReportStatus;

  /** ID of the user who filed the report */
  @Column({ type: 'uuid' })
  reporter_id: string;

  /** ID of the reported post (if type = post) */
  @Column({ type: 'uuid', nullable: true })
  reported_post_id: string;

  /** ID of the reported user (if type = user) */
  @Column({ type: 'uuid', nullable: true })
  reported_user_id: string;

  /** ID of the reported message (if type = message) */
  @Column({ type: 'uuid', nullable: true })
  reported_message_id: string;

  /** ID of the reported comment (if type = comment) */
  @Column({ type: 'uuid', nullable: true })
  reported_comment_id: string;

  /** Admin note on resolution */
  @Column({ nullable: true })
  admin_note: string;

  @Column({ type: 'enum', enum: ReportAction, nullable: true })
  admin_action: ReportAction;

  @Column({ type: 'uuid', nullable: true })
  resolved_by: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  resolved_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporter_id' })
  reporter: User;

  @ManyToOne(() => Post, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reported_post_id' })
  reported_post: Post;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reported_user_id' })
  reported_user: User;

  @ManyToOne(() => ChatMessage, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reported_message_id' })
  reported_message: ChatMessage;

  @ManyToOne(() => Comment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reported_comment_id' })
  reported_comment: Comment;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'resolved_by' })
  resolved_by_user: User;
}
