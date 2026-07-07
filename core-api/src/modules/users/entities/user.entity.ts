import { MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ChatMember } from 'src/modules/chats/entities/chat-member.entity';
import { ChatMessage } from 'src/modules/chats/entities/chat-message.entity';
import { ChatRoom } from 'src/modules/chats/entities/chat-room.entity';
import { Comment } from 'src/modules/posts/comments/entities/comment.entity';
import { GenderType } from 'src/common/enums/gender.enum';
import { PrivacyType } from 'src/common/enums/privacy.enum';
import { RoleType } from 'src/common/enums/role.enum';
import { UserCategoryType } from 'src/common/enums/user-category.enum';
import { MessagePrivacyType } from 'src/common/enums/message-privacy.enum';
import { MentionPrivacyType } from 'src/common/enums/mention-privacy.enum';
import { NotificationUser } from 'src/modules/notifications/notification-users/entities/notification-user.entity';
import { PinChat } from 'src/modules/chats/pin-chats/entities/pin-chat.entity';
import { Post } from 'src/modules/posts/entities/post.entity';
import { Relation } from 'src/modules/users/relations/entities/relation.entity';
import { SaveList } from 'src/modules/posts/bookmarks/save-lists/entities/save-list.entity';
import { RelationType } from 'src/common/enums/relation.enum';

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
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ unique: true })
  email: string;

  @Index()
  @Column()
  @MinLength(8)
  @MaxLength(15)
  password: string;

  @Index()
  @Column({ nullable: true })
  avatar: string;

  @Column({ nullable: true })
  cover_photo: string;

  @Index()
  @Column()
  username: string;

  @Column({ nullable: true })
  full_name: string;

  @Column({ nullable: true })
  bio: string;

  @Column({ nullable: true })
  website: string;

  @Column({ nullable: true })
  birthday: Date;

  @Column({ type: 'enum', enum: GenderType, nullable: true })
  gender: GenderType;

  @Column({ nullable: true })
  address: string;

  @Column({ type: 'enum', enum: PrivacyType, default: PrivacyType.PUBLIC })
  privacy: PrivacyType;

  @Column({ type: 'enum', enum: MessagePrivacyType, default: MessagePrivacyType.EVERYONE })
  message_privacy: MessagePrivacyType;

  @Column({ type: 'enum', enum: MentionPrivacyType, default: MentionPrivacyType.EVERYONE })
  mention_privacy: MentionPrivacyType;

  @Column({ nullable: true })
  last_active: Date;

  @Column({
    type: 'enum',
    enum: UserCategoryType,
    default: UserCategoryType.CASUALUSER,
  })
  user_category: UserCategoryType;

  @Column({ type: 'enum', enum: RoleType, default: RoleType.USER })
  role: RoleType;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn({ nullable: true })
  updated_at: Date;

  @OneToMany(() => Relation, (relation) => relation.request_side)
  sent_relations: Relation[];

  @OneToMany(() => Relation, (relation) => relation.accept_side)
  received_relations: Relation[];

  @OneToMany(
    () => NotificationUser,
    (notification_user) => notification_user.user,
  )
  notification_users: NotificationUser[];

  @OneToMany(() => ChatRoom, (chatRoom) => chatRoom.user)
  chat_rooms: ChatRoom[];

  @OneToMany(() => ChatMember, (chatMember) => chatMember.user)
  chat_members: ChatMember[];

  @OneToMany(() => ChatMessage, (chatMessage) => chatMessage.user)
  chat_messages: ChatMessage[];

  @OneToMany(() => Post, (post) => post.user)
  posts: Post[];

  @OneToMany(() => SaveList, (saveList) => saveList.user)
  save_lists: SaveList[];

  @OneToMany(() => Comment, (comment) => comment.user)
  comments: Comment[];

  @OneToMany(() => PinChat, (pinChat) => pinChat.user)
  pin_chats: PinChat[];

  @ApiPropertyOptional({
    description: 'Viewer relation status to this user in feed/post responses',
    enum: RelationType,
  })
  relationStatus?: RelationType;

  @ApiPropertyOptional({
    description: 'Whether the current viewer follows this user',
    type: Boolean,
  })
  isFollowing?: boolean;
}
