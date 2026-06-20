import { User } from 'src/modules/users/entities/user.entity';
import { PrivacyType } from 'src/common/enums/privacy.enum';
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
import { StoryView } from './story-view.entity';

export enum StoryType {
  IMAGE = 'image',
  VIDEO = 'video',
  TEXT = 'text',
}

@Entity()
export class Story {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'enum', enum: StoryType, default: StoryType.IMAGE })
  type: StoryType;

  /** URL ảnh/video (null nếu là story text). */
  @Column({ default: null })
  media_url: string;

  /** Nội dung text (cho story dạng text/nền màu). */
  @Column({ type: 'text', default: null })
  content: string;

  /** Màu nền (hex/gradient) cho story text. */
  @Column({ default: null })
  background: string;

  @Column({ default: PrivacyType.PUBLIC, enum: PrivacyType })
  privacy: PrivacyType;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  /** Thời điểm hết hạn (mặc định created_at + 24h). */
  @Index()
  @Column({ type: 'timestamp with time zone' })
  expires_at: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => StoryView, (view) => view.story)
  views: StoryView[];
}
