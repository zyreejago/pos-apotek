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
    query: jest.fn(),
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
    mockPool.query.mockResolvedValueOnce([{ insertId: 10 }, []]);

    const res = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'PT A', contact_person: 'B', phone: '1', address: 'X' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(10);
  });

  test('POST /api/suppliers error returns 500', async () => {
    const { app, token, mockPool } = await loadApp();
    mockPool.query.mockRejectedValueOnce(new Error('insert fail'));

    const res = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'PT A' });

    expect(res.status).toBe(500);
  });

  test('PUT /api/suppliers/:id success returns 200', async () => {
    const { app, token, mockPool } = await loadApp();
    mockPool.query.mockResolvedValueOnce([{}, []]);

    const res = await request(app)
      .put('/api/suppliers/1')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'PT B', contact_person: 'C', phone: '2', address: 'Y' });

    expect(res.status).toBe(200);
  });

  test('PUT /api/suppliers/:id error returns 500', async () => {
    const { app, token, mockPool } = await loadApp();
    mockPool.query.mockRejectedValueOnce(new Error('update fail'));

    const res = await request(app)
      .put('/api/suppliers/1')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'PT B' });

    expect(res.status).toBe(500);
  });

  test('DELETE /api/suppliers/:id success returns 200', async () => {
    const { app, token, mockPool } = await loadApp();
    mockPool.query.mockResolvedValueOnce([{}, []]);

    const res = await request(app)
      .delete('/api/suppliers/1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  test('DELETE /api/suppliers/:id error returns 500', async () => {
    const { app, token, mockPool } = await loadApp();
    mockPool.query.mockRejectedValueOnce(new Error('delete fail'));

    const res = await request(app)
      .delete('/api/suppliers/1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);
  });
});

