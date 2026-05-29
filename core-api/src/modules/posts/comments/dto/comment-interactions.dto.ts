import { ApiProperty } from '@nestjs/swagger';

export class CommentInteractions {
  @ApiProperty()
  likes: number;

  @ApiProperty()
  recomments: number;

  @ApiProperty()
  comments: number;
}
