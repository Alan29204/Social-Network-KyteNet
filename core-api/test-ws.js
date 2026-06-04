const io = require('socket.io-client');
const { Client } = require('pg');
const axios = require('axios');

async function run() {
  const client = new Client({
    connectionString:
      'postgresql://postgres:123456@localhost:5433/social-network-SNet',
  });
  await client.connect();
  const res = await client.query('SELECT email FROM "user" LIMIT 1');
  const email = res.rows[0].email;

  // Login to get token
  const loginRes = await axios.post('http://localhost:3000/auth/sign-in', {
    email,
    password: 'Password123',
  });
  const token = loginRes.data.data.access_token;

  const socket = io('ws://localhost:3000', {
    auth: { token: `Bearer ${token}` },
  });

  socket.on('connect', () => {
    console.log('Connected!');
    socket.emit('sendMessage', {
      chat_room_id: 'fa9dc4d9-0259-46e6-8827-6572aae8c3eb',
      shared_post_id: '91a78625-f726-44c1-bf61-3965ee093f44',
      tempId: 'temp-123',
    });
  });

  socket.on('messageSaved', (data) => {
    console.log('Message Saved:', data);
    process.exit(0);
  });

  socket.on('connect_error', (err) => {
    console.error('Socket error:', err);
    process.exit(1);
  });
}
run().catch(console.error);
