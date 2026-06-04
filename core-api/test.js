const { Client } = require('pg');
const axios = require('axios');
const FormData = require('form-data');

async function run() {
  const client = new Client({ connectionString: 'postgresql://postgres:123456@localhost:5433/social-network-SNet' });
  await client.connect();
  const res = await client.query('SELECT email FROM "user" LIMIT 1');
  const email = res.rows[0].email;
  console.log('Login with email:', email);
  
  const login = await axios.post('http://localhost:3000/auth/login', {
    email,
    password: 'Password123' // hope this is the default
  });
  
  const token = login.data.data.access_token;
  
  const form = new FormData();
  form.append('chat_room_id', 'fa9dc4d9-0259-46e6-8827-6572aae8c3eb'); // from my previous db query
  form.append('shared_post_id', '91a78625-f726-44c1-bf61-3965ee093f44'); // random uuid
  
  try {
    const postRes = await axios.post('http://localhost:3000/chat-messages', form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${token}`
      }
    });
    console.log('Post success:', postRes.data);
  } catch(e) {
    console.error('Post error:', e.response?.data || e.message);
  }
  
  await client.end();
}
run();
