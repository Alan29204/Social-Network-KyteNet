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

export enum ReportType {
  POST = 'post',
  USER = 'user',
  MESSAGE = 'message',
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

  /** Admin note on resolution */
  @Column({ nullable: true })
  admin_note: string;

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
}
