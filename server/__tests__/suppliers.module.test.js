const request = require('supertest');
const jwt = require('jsonwebtoken');

async function loadApp() {
  process.env.JWT_SECRET = 'test_jwt_secret';

  jest.resetModules();

  const mockConnection = {
    query: jest.fn(),
    release: jest.fn(),
  };

  const mockPool = {
    query: jest.fn().mockResolvedValue([[]]),
    getConnection: jest.fn().mockResolvedValue(mockConnection),
  };

  jest.doMock('../db', () => ({
    pool: mockPool,
    initDB: jest.fn().mockResolvedValue(undefined),
  }));

  const { app } = require('../index');

  const token = jwt.sign(
    { id: 1, username: 'admin', role: 'superadmin', email: 'admin@example.com' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  return { app, token, mockPool, mockConnection };
}

describe('suppliers module', () => {
  test('GET /api/suppliers without search returns list', async () => {
    const { app, token, mockConnection } = await loadApp();

    mockConnection.query
      .mockResolvedValueOnce([[{ id: 1, name: 'PT A' }], []])
      .mockResolvedValueOnce([[{ total: 1 }], []]);

    const res = await request(app)
      .get('/api/suppliers?page=1&limit=10')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(1);
  });

  test('GET /api/suppliers with search returns list', async () => {
    const { app, token, mockConnection } = await loadApp();

    mockConnection.query
      .mockResolvedValueOnce([[{ id: 1, name: 'PT A' }], []])
      .mockResolvedValueOnce([[{ total: 1 }], []]);

    const res = await request(app)
      .get('/api/suppliers?page=1&limit=10&search=PT')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /api/suppliers error returns 500', async () => {
    const { app, token, mockPool } = await loadApp();
    mockPool.getConnection.mockRejectedValueOnce(new Error('db down'));

    const res = await request(app)
      .get('/api/suppliers')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);
  });

  test('POST /api/suppliers validation returns 400', async () => {
    const { app, token } = await loadApp();
    const res = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '1' });
    expect(res.status).toBe(400);
  });

  test('POST /api/suppliers success returns 201', async () => {
    const { app, token, mockPool } = await loadApp();
    mockPool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 10 }, []]);

    const res = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'PT A', contact_person: 'B', phone: '1', address: 'X' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(10);
  });

  test('POST /api/suppliers error returns 500', async () => {
    const { app, token, mockPool } = await loadApp();
    mockPool.query
      .mockResolvedValueOnce([[]])
      .mockRejectedValueOnce(new Error('insert fail'));

    const res = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'PT A' });

    expect(res.status).toBe(500);
  });

  test('PUT /api/suppliers/:id success returns 200', async () => {
    const { app, token, mockPool } = await loadApp();
    mockPool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ id: 1, name: 'PT A' }])
      .mockResolvedValueOnce([{}]);

    const res = await request(app)
      .put('/api/suppliers/1')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'PT B', contact_person: 'C', phone: '2', address: 'Y' });

    expect(res.status).toBe(200);
  });

  test('PUT /api/suppliers/:id error returns 500', async () => {
    const { app, token, mockPool } = await loadApp();
    mockPool.query
      .mockResolvedValueOnce([[]])
      .mockRejectedValueOnce(new Error('update fail'));

    const res = await request(app)
      .put('/api/suppliers/1')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'PT B' });

    expect(res.status).toBe(500);
  });

  test('DELETE /api/suppliers/:id success returns 200', async () => {
    const { app, token, mockPool } = await loadApp();
    mockPool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ id: 1, name: 'PT A' }])
      .mockResolvedValueOnce([{}]);

    const res = await request(app)
      .delete('/api/suppliers/1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  test('DELETE /api/suppliers/:id error returns 500', async () => {
    const { app, token, mockPool } = await loadApp();
    mockPool.query
      .mockResolvedValueOnce([[]])
      .mockRejectedValueOnce(new Error('delete fail'));

    const res = await request(app)
      .delete('/api/suppliers/1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);
  });

  test('GET /api/suppliers/:id success returns supplier details', async () => {
    const { app, token, mockConnection } = await loadApp();

    mockConnection.query
      .mockResolvedValueOnce([[{ id: 1, name: 'PT A' }], []])
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .get('/api/suppliers/1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.supplier.name).toBe('PT A');
    expect(res.body.purchases).toEqual([]);
    expect(res.body.batches).toEqual([]);
    expect(res.body.products).toEqual([]);
  });

  test('GET /api/suppliers/:id returns 404 when supplier not found', async () => {
    const { app, token, mockConnection } = await loadApp();

    mockConnection.query.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .get('/api/suppliers/999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Supplier not found');
  });

  test('GET /api/suppliers/:id error returns 500', async () => {
    const { app, token, mockPool } = await loadApp();
    mockPool.getConnection.mockRejectedValueOnce(new Error('connection fail'));

    const res = await request(app)
      .get('/api/suppliers/1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Server error');
  });

  test('GET /api/suppliers/:id with batches and purchase details', async () => {
    const { app, token, mockConnection } = await loadApp();

    mockConnection.query
      .mockResolvedValueOnce([[{ id: 1, name: 'PT A' }], []])
      .mockResolvedValueOnce([[{ id: 10, invoice_no: 'INV-001' }], []])
      .mockResolvedValueOnce([[{ id: 99, batch_no: 'B001' }], []])
      .mockResolvedValueOnce([[{ id: 1, amount: 1000 }], []])
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[{ id: 1, product_name: 'P1' }], []])
      .mockResolvedValueOnce([[{ id: 1, amount: 5000 }], []]);

    const res = await request(app)
      .get('/api/suppliers/1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.batches[0].dp_payments).toEqual([{ id: 1, amount: 1000 }]);
    expect(res.body.purchases).toHaveLength(1);
    expect(res.body.purchases[0].items).toHaveLength(1);
    expect(res.body.purchases[0].payments).toHaveLength(1);
  });

  test('GET /api/suppliers/:id handles dp_payments query error gracefully', async () => {
    const { app, token, mockConnection } = await loadApp();

    mockConnection.query
      .mockResolvedValueOnce([[{ id: 1, name: 'PT A' }], []])
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[{ id: 99, batch_no: 'B001' }], []])
      .mockRejectedValueOnce(new Error('dp table missing'))
      .mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .get('/api/suppliers/1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.batches[0].dp_payments).toEqual([]);
  });
});

