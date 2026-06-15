import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export enum ChatRoomListType {
  PRIMARY = 'primary',
  REQUESTS = 'requests',
}

export class GetListChatRoomDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ChatRoomListType, default: ChatRoomListType.PRIMARY })
  @IsEnum(ChatRoomListType)
  @IsOptional()
  type?: ChatRoomListType = ChatRoomListType.PRIMARY;
}
