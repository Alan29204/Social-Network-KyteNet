const { Client } = require('pg');

const client = new Client('postgres://postgres:123456@localhost:5433/social-network-SNet');

client.connect()
  .then(() => client.query("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE typname = 'notification_notification_type_enum'"))
  .then(res => {
    console.log('ENUM VALUES:', res.rows);
    
    // Check if mention is there
    if (!res.rows.find(row => row.enumlabel === 'mention')) {
       console.log("Adding 'mention' to enum...");
       return client.query("ALTER TYPE notification_notification_type_enum ADD VALUE 'mention'");
    } else {
       console.log("Enum 'mention' already exists.");
    }
  })
  .then(() => {
    console.log('Done.');
    client.end();
  })
  .catch(e => {
    console.error('Error Object:', e);
    client.end();
  });
