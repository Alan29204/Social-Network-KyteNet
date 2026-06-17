const { Client } = require('pg');

const client = new Client('postgres://postgres:postgres@localhost:5432/social_network');

client.connect()
  .then(() => client.query("ALTER TYPE notification_notification_type_enum ADD VALUE 'mention'"))
  .then(() => {
    console.log('success');
    client.end();
  })
  .catch(e => {
    console.log('Error:', e.message);
    client.end();
  });
