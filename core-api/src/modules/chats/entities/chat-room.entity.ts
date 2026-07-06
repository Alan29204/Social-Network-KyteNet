import { ChatMember } from 'src/modules/chats/entities/chat-member.entity';
import { ChatMessage } from 'src/modules/chats/entities/chat-message.entity';
import { MemberType } from 'src/common/enums/member.enum';
import { ReactionType } from 'src/common/enums/reaction.enum';
import { PinChat } from 'src/modules/chats/pin-chats/entities/pin-chat.entity';
import { PinMessage } from 'src/modules/chats/pin-messages/entities/pin-messages.entity';
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

@Entity()
export class ChatRoom {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  name: string;

  @Index()
  @Column({ default: 'group' })
  type: 'direct' | 'group';

  @Index()
  @Column({ nullable: true })
  avatar: string;

  @Column({ type: 'uuid' })
  created_by: string;

  // null cho direct chat (không có khái niệm "quyền thêm"); nhóm: 'admin' | 'member'.
  @Column({ type: 'enum', enum: MemberType, nullable: true })
  permission_add_member: MemberType | null;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  last_message_at: Date;

  @Index()
  @Column({ type: 'enum', enum: ReactionType, default: ReactionType.LIKE })
  reaction_default: ReactionType;

  @Column({ type: 'varchar', nullable: true, default: '👍' })
  quick_emoji: string;

  @Column({ default: false })
  end_to_end_encryption: boolean;

  @ManyToOne(() => User, (user) => user.chat_rooms)
  @JoinColumn({ name: 'created_by' })
  user: User;

  @OneToMany(() => ChatMember, (chatMember) => chatMember.chat_room)
  chat_members: ChatMember[];

  @OneToMany(() => ChatMessage, (chatMessage) => chatMessage.chat_room)
  chat_messages: ChatMessage[];

  @OneToMany(() => PinMessage, (pinMessage) => pinMessage.chat_room)
  pin_messages: PinMessage[];

  @OneToMany(() => PinChat, (pinChat) => pinChat.chat_room)
  pin_chats: PinChat[];
}
