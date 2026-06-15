const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/social_network' });
client.connect()
  .then(() => client.query("SELECT privacy FROM users WHERE username = 'Kevin_11'"))
  .then(res => { console.log(res.rows); client.end(); })
  .catch(e => console.error(e));
