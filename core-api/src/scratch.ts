import { DataSource } from 'typeorm';

const dataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: '123',
  database: 'social_network',
});

async function run() {
  await dataSource.initialize();
  const messages = await dataSource.query(
    `SELECT id, message, medias, created_at FROM chat_message ORDER BY created_at DESC LIMIT 5`,
  );
  console.log(messages);
  await dataSource.destroy();
}

run();
