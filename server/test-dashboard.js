const axios = require('axios');

async function testDashboardAPI() {
  try {
    // 1. Login to get token (using superadmin seeded in initDB)
    const loginRes = await axios.post('http://localhost:5000/api/login', {
      username: 'superadmin',
      password: 'password123'
    });
    const token = loginRes.data.token;
    console.log('Login successful, token obtained.');

    // 2. Fetch Dashboard Data
    const dashboardRes = await axios.get('http://localhost:5000/api/dashboard', {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('Dashboard Data:', JSON.stringify(dashboardRes.data, null, 2));
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

testDashboardAPI();