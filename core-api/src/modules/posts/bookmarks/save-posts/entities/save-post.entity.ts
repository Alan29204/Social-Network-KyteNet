import { Post } from 'src/modules/posts/entities/post.entity';
import { SaveList } from 'src/modules/posts/bookmarks/save-lists/entities/save-list.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity()
@Unique(['save_list_id', 'post_id'])
export class SavePost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  save_list_id: string;

  @Index()
  @Column()
  post_id: string;

  @ManyToOne(() => SaveList, (saveList) => saveList.save_posts)
  @JoinColumn({ name: 'save_list_id' })
  save_list: SaveList;

  @ManyToOne(() => Post, (post) => post.save_posts)
  @JoinColumn({ name: 'post_id' })
  post: Post;
}
