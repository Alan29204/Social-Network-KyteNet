const { Client } = require('pg'); 
const client = new Client({ connectionString: 'postgresql://postgres:123456@localhost:5433/social-network-SNet' }); 
client.connect().then(() => client.query("UPDATE chat_message SET shared_post_id = '2192cb59-3130-4fb8-9bd9-f0cc00101679' WHERE id = '60ebd4e5-51a8-43ed-8a04-8c45a95e0388'").then(res => { console.log('Updated'); client.end(); }))
