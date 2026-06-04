const { Client } = require('pg');
const axios = require('axios');

async function run() {
  const client = new Client({ connectionString: 'postgresql://postgres:123456@localhost:5433/social-network-SNet' });
  await client.connect();
  const res = await client.query('SELECT email FROM "user" LIMIT 1');
  const email = res.rows[0].email;
  console.log('Login with email:', email);
  
  const login = await axios.post('http://localhost:3000/users/login', {
    email,
    password: 'Password123'
  });
  
  const token = login.data.data.access_token;
  
  try {
    const notiRes = await axios.get('http://localhost:3000/notifications', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Notifications:', JSON.stringify(notiRes.data, null, 2));
  } catch(e) {
    console.error('Fetch error:', e.response?.data || e.message);
  }
  
  await client.end();
}
run();
