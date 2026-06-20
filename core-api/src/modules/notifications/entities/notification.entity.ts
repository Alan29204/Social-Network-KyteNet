import { NotificationType } from 'src/common/enums/notification.enum';
import { NotificationUser } from 'src/modules/notifications/notification-users/entities/notification-user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ default: null })
  title: string;

  @Index()
  @Column({ default: null })
  message: string;

  @Column({ type: 'enum', enum: NotificationType })
  notification_type: NotificationType;

  @Index()
  @Column({ nullable: true })
  target_type: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  target_id: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @OneToMany(
    () => NotificationUser,
    (notificationUser) => notificationUser.notification,
  )
  notification_user: NotificationUser[];
}
