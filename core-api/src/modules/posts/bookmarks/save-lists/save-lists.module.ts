import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SaveListsService } from './save-lists.service';
import { SaveListsController } from './save-lists.controller';
import { SaveList } from './entities/save-list.entity';
import { SavePost } from 'src/modules/posts/bookmarks/save-posts/entities/save-post.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SaveList, SavePost])],
  controllers: [SaveListsController],
  providers: [SaveListsService],
})
export class SaveListsModule {}
