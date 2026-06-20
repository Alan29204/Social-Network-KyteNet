import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ReactionType } from 'src/common/enums/reaction.enum';

export class CreateReactionDto {
  @IsOptional()
  @IsUUID()
  @ApiProperty({ required: false, description: 'Post ID' })
  postId?: string;

  @IsOptional()
  @IsUUID()
  @ApiProperty({ required: false, description: 'Comment ID' })
  commentId?: string;

  @IsOptional()
  @IsEnum(ReactionType)
  @ApiProperty({
    required: false,
    enum: ReactionType,
    default: ReactionType.LIKE,
    description: 'Reaction type (like, love, haha, wow, sad, angry)',
  })
  reaction?: ReactionType;
}
