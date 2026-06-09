import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavePostsService } from './save-posts.service';
import { SavePostsController } from './save-posts.controller';
import { SavePost } from './entities/save-post.entity';
import { SaveList } from 'src/modules/posts/bookmarks/save-lists/entities/save-list.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SavePost, SaveList])],
  controllers: [SavePostsController],
  providers: [SavePostsService],
  exports: [SavePostsService],
})
export class SavePostsModule {}
