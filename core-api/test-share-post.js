const axios = require('axios');
const FormData = require('form-data');

async function test() {
  try {
    const form = new FormData();
    form.append('chat_room_id', 'fa9dc4d9-0259-46e6-8827-6572aae8c3eb');
    form.append('shared_post_id', '91a78625-f726-44c1-bf61-3965ee093f44'); // some post ID
    
    // Simulate API call from frontend
    // Note: this will fail 401 without JWT, but let's just see what it throws
    const res = await axios.post('http://localhost:3000/chat-messages', form, {
      headers: {
        ...form.getHeaders(),
      }
    });
    console.log('Success:', res.data);
  } catch(e) {
    console.error('Error:', e.response?.data || e.message);
  }
}
test();
