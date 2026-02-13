
const jwt = require('jsonwebtoken');
const http = require('http');

const SECRET = 'your_super_secret_key';
const token = jwt.sign({ id: 999, username: 'test', role: 'Casier' }, SECRET);

function test() {
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/rbac/permissions?roleName=Casier',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log('Response status:', res.statusCode);
      try {
        const json = JSON.parse(data);
        const mod = json.find(m => m.module === 'Management Pengguna');
        console.log('Management Pengguna permissions:', mod);
      } catch (e) {
        console.log('Response body:', data);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
  });

  req.end();
}

test();
