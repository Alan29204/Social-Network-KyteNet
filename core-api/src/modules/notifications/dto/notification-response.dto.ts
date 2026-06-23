import { ApiProperty } from '@nestjs/swagger';
import { NotificationType } from 'src/common/enums/notification.enum';

export class NotificationActorDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  username: string;

  @ApiProperty({ nullable: true })
  avatar: string | null;
}

export class NotificationMetadataDto {
  @ApiProperty({ type: [NotificationActorDto] })
  actors: NotificationActorDto[];

  @ApiProperty({ nullable: true })
  thumbnail?: string | null;

  @ApiProperty({ nullable: true })
  reaction?: string;

  @ApiProperty({ nullable: true })
  context?: string;

  @ApiProperty({ nullable: true })
  postId?: string;

  @ApiProperty({ nullable: true })
  commentId?: string;

  @ApiProperty({ nullable: true })
  aggregationKey?: string;

  @ApiProperty({ nullable: true })
  comment_type?: string;

  @ApiProperty({ nullable: true })
  relation_type?: string;
}

export class NotificationItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  notification_id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  message: string;

  @ApiProperty({ enum: NotificationType })
  notification_type: NotificationType;

  @ApiProperty({ nullable: true })
  target_type: string | null;

  @ApiProperty({ nullable: true })
  target_id: string | null;

  @ApiProperty()
  is_read: boolean;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;

  @ApiProperty({ type: NotificationMetadataDto, nullable: true })
  metadata: NotificationMetadataDto | null;
}

export class NotificationPaginationMetaDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}

export class NotificationListResponseDto {
  @ApiProperty({ type: [NotificationItemDto] })
  data: NotificationItemDto[];

  @ApiProperty({ type: NotificationPaginationMetaDto })
  meta: NotificationPaginationMetaDto;
}

export class UnreadCountResponseDto {
  @ApiProperty()
  unread_count: number;
}
