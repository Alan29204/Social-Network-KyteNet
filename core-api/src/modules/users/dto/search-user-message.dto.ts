import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO cho từng user item trong kết quả tìm kiếm tin nhắn.
 * Dùng cho Swagger response schema.
 */
export class SearchUserMessageItemDto {
  @ApiProperty({ description: 'User ID' })
  id: string;

  @ApiProperty({ description: 'Username' })
  username: string;

  @ApiProperty({ description: 'Full name', required: false })
  full_name: string;

  @ApiProperty({ description: 'Avatar URL', required: false })
  avatar: string;

  @ApiProperty({ description: 'Privacy setting', required: false })
  privacy: string;

  @ApiProperty({ description: 'Message privacy setting', required: false })
  message_privacy: string;

  @ApiProperty({
    description: 'Ranking score (2 = following, 1 = others)',
    required: false,
  })
  rank: number;

  @ApiProperty({ description: 'Mutual friend count', required: false })
  mutual_count: number;
}

/**
 * DTO cho response của search-messages endpoint.
 * Bọc mảng users trong { data } để thống nhất với các endpoint khác.
 */
export class SearchUserMessageResponseDto {
  @ApiProperty({
    type: [SearchUserMessageItemDto],
    description: 'List of matched users',
  })
  data: SearchUserMessageItemDto[];
}
