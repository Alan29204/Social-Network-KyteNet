import axios from 'axios';

async function test() {
  try {
    // First login to get token
    const loginRes = await axios.post('http://127.0.0.1:3000/users/login', {
      email: 'user2@example.com', // Alan_2
      password: 'password123',
      deviceId: 'test'
    });
    
    const token = loginRes.data.data.accessToken;
    console.log('Login success');
    
    const searchEmpty = await axios.get('http://127.0.0.1:3000/users/search-messages?q=', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Search empty result keys:', Object.keys(searchEmpty.data));
    console.log('Search empty result data:', searchEmpty.data.data || searchEmpty.data);

    const searchRes = await axios.get('http://127.0.0.1:3000/users/search-messages?q=Kevin_11', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Search Kevin_11 result:', searchRes.data.data || searchRes.data);

  } catch (error: any) {
    console.error('Error:', error);
  }
}

test();
