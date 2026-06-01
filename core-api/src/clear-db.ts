import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  synchronize: false, // Tắt synchronize để không bị lỗi lúc khởi tạo
});

async function clearDB() {
  try {
    await dataSource.initialize();
    await dataSource.query(`DROP SCHEMA public CASCADE;`);
    await dataSource.query(`CREATE SCHEMA public;`);
    console.log('✅ Đã xóa toàn bộ dữ liệu và schema cũ thành công!');
  } catch (err) {
    console.error('❌ Lỗi khi xóa DB:', err);
  } finally {
    await dataSource.destroy();
  }
}

clearDB();
