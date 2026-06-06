import { ChatRoom } from 'src/modules/chats/entities/chat-room.entity';
import { MemberType } from 'src/common/enums/member.enum';
import { User } from 'src/modules/users/entities/user.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity()
export class ChatMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  chat_room_id: string;

  @Index()
  @Column()
  user_id: string;

  @Index()
  @Column({
    type: 'enum',
    enum: MemberType,
    default: MemberType.MEMBER,
  })
  member_type: MemberType;

  @Column({ default: '' })
  nickname: string;

  @Column({ default: true })
  allow_notification: boolean;

  @Column({ default: false })
  is_muted: boolean;

  @Column({ type: 'timestamp', nullable: true })
  deleted_at: Date;

  @Column({ default: 0 })
  unread_count: number;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => User, (user) => user.chat_members)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => ChatRoom, (chatRoom) => chatRoom.chat_members)
  @JoinColumn({ name: 'chat_room_id' })
  chat_room: ChatRoom;
}
