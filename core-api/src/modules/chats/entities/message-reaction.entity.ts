import { ReactionType } from 'src/common/enums/reaction.enum';
import { ChatMessage } from 'src/modules/chats/entities/chat-message.entity';
import { User } from 'src/modules/users/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/**
 * MessageReaction entity — stores emoji reactions on chat messages.
 * Each user can have only ONE reaction per message (toggle or switch).
 */
@Entity()
@Unique(['chat_message_id', 'user_id'])
export class MessageReaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  chat_message_id: string;

  @Column()
  user_id: string;

  @Column({ type: 'enum', enum: ReactionType })
  reaction_type: ReactionType;

  @ManyToOne(() => ChatMessage, (msg) => msg.reactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chat_message_id' })
  chat_message: ChatMessage;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn()
  created_at: Date;
}
