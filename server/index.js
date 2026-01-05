const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// In-memory data store for outlets
let outlets = [
  { id: 1, name: 'Cabang XYZ', location: 'Baktiseraga', status: 'Active' },
  { id: 2, name: 'Cabang ABC', location: 'Banyuning', status: 'Active' }
];

app.get('/', (req, res) => {
  res.send('API is running...');
});

// Get all outlets
app.get('/api/outlets', (req, res) => {
  res.json(outlets);
});

// Add a new outlet
app.post('/api/outlets', (req, res) => {
  const { name, location } = req.body;
  if (!name || !location) {
    return res.status(400).json({ message: 'Name and location are required' });
  }
  
  const newOutlet = {
    id: outlets.length + 1,
    name,
    location,
    status: 'Active' // Default status
  };
  
  outlets.push(newOutlet);
  res.status(201).json(newOutlet);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
