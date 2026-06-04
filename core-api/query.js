const { Client } = require('pg'); 
const client = new Client({ connectionString: 'postgresql://postgres:123456@localhost:5433/social-network-SNet' }); 
client.connect().then(() => client.query('SELECT * FROM chat_message ORDER BY created_at DESC LIMIT 5').then(res => { console.log(res.rows); client.end(); }))
