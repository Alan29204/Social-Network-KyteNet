import { ApiProperty } from '@nestjs/swagger';

export class PostInteractions {
  @ApiProperty()
  likes: number;

  @ApiProperty()
  comments: number;

  @ApiProperty()
  reposts: number;
}
