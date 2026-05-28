import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { User } from './modules/users/entities/user.entity';
import { Post } from './modules/posts/entities/post.entity';
import { Relation } from './modules/users/relations/entities/relation.entity';
import { RelationType } from './common/enums/relation.enum';
import { PrivacyType } from './common/enums/privacy.enum';
import * as bcrypt from 'bcrypt';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  const userRepository = dataSource.getRepository(User);
  const postRepository = dataSource.getRepository(Post);
  const relationRepository = dataSource.getRepository(Relation);

  console.log('Starting DB seed...');

  // Create 10 users
  const users = [];
  for (let i = 1; i <= 10; i++) {
    const user = new User();
    user.email = `user${i}@example.com`;
    user.username = `user${i}`;
    user.password = await bcrypt.hash('password123', 10);
    user.privacy = PrivacyType.PUBLIC;
    users.push(user);
  }

  const savedUsers = await userRepository.save(users);
  console.log(`Created ${savedUsers.length} users.`);

  // Create relationships: first 5 users are friends with each other
  // So user 1 is friend with 2, 3, 4, 5. User 2 with 3, 4, 5, etc.
  // Friend relation usually requires two records (or one depending on logic, but relation.entity.ts implies one record per direction or just one mutual record. Let's create both ways or just one as a friend type).
  // Actually, friend relation in social networks can be represented by 1 row if undirected, or 2 rows if directed.
  // We'll create one row for each pair to avoid unique constraint if it exists. Wait, 'request_side_id' and 'accept_side_id' are unique together.
  const relations = [];
  for (let i = 0; i < 5; i++) {
    for (let j = i + 1; j < 5; j++) {
      const relation1 = new Relation();
      relation1.request_side_id = savedUsers[i].id;
      relation1.accept_side_id = savedUsers[j].id;
      relation1.relation_type = RelationType.FRIEND;
      relations.push(relation1);

      const relation2 = new Relation();
      relation2.request_side_id = savedUsers[j].id;
      relation2.accept_side_id = savedUsers[i].id;
      relation2.relation_type = RelationType.FRIEND;
      relations.push(relation2);
    }
  }

  await relationRepository.save(relations);
  console.log(`Created ${relations.length} relations (5 users are friends).`);

  // Create 1 post for each user
  const posts = [];
  for (const user of savedUsers) {
    const post = new Post();
    post.user_id = user.id;
    post.content = `This is the first post from ${user.username}!`;
    post.privacy = PrivacyType.PUBLIC;
    post.created_at = new Date();
    posts.push(post);
  }

  await postRepository.save(posts);
  console.log(`Created ${posts.length} posts.`);

  console.log('Seeding completed successfully!');
  await app.close();
}

bootstrap().catch((err) => {
  console.error('Seeding failed', err);
  process.exit(1);
});
