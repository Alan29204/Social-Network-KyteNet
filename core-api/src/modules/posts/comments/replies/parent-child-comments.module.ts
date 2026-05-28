import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParentChildCommentsService } from './parent-child-comments.service';
import { ParentChildCommentsController } from './parent-child-comments.controller';
import { ParentChildComment } from './entities/parent-child-comment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ParentChildComment])],
  controllers: [ParentChildCommentsController],
  providers: [ParentChildCommentsService],
})
export class ParentChildCommentsModule {}
