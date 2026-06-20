import { ChatRoom } from 'src/modules/chats/entities/chat-room.entity';
import { MessageStatusType } from 'src/common/enums/message-status.enum';
import { MessageReaction } from 'src/modules/chats/entities/message-reaction.entity';
import { PinMessage } from 'src/modules/chats/pin-messages/entities/pin-messages.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { Post } from 'src/modules/posts/entities/post.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  chat_room_id: string;

  @Column({ type: 'uuid' })
  created_by: string;

  @Column()
  @Index()
  message: string;

  @Index()
  @Column('text', { array: true, default: null })
  medias: string[];

  @Index()
  @Column({
    type: 'enum',
    enum: MessageStatusType,
    default: MessageStatusType.NORMAL,
  })
  message_status: MessageStatusType;

  @ManyToOne(() => ChatRoom, (chatRoom) => chatRoom.chat_messages)
  @JoinColumn({ name: 'chat_room_id' })
  chat_room: ChatRoom;

  @ManyToOne(() => User, (user) => user.chat_messages)
  @JoinColumn({ name: 'created_by' })
  user: User;

  @CreateDateColumn()
  created_at: Date;

  @OneToOne(() => PinMessage, (pinMessage) => pinMessage.chat_message)
  pin_messages: PinMessage;

  /** ID of the message being replied to (nullable) */
  @Column({ type: 'uuid', nullable: true })
  reply_to_id: string;

  /** The message being replied to */
  @ManyToOne(() => ChatMessage, { nullable: true })
  @JoinColumn({ name: 'reply_to_id' })
  reply_to: ChatMessage;

  /** Emoji reactions on this message */
  @OneToMany(() => MessageReaction, (r) => r.chat_message)
  reactions: MessageReaction[];

  /** The post being shared in this message (nullable) */
  @Column({ type: 'uuid', nullable: true })
  shared_post_id: string;

  @ManyToOne(() => Post, { nullable: true })
  @JoinColumn({ name: 'shared_post_id' })
  shared_post: Post;
}
