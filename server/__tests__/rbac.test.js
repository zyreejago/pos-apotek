const request = require('supertest');
const jwt = require('jsonwebtoken');

async function loadAppWithMockedDb() {
  process.env.JWT_SECRET = 'test_jwt_secret';

  jest.resetModules();

  const mockConnection = {
    query: jest.fn(),
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
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

  const superadminToken = jwt.sign(
    { id: 1, username: 'admin', role: 'superadmin', email: 'admin@example.com' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const userToken = jwt.sign(
    { id: 2, username: 'u', role: 'user', email: 'u@u.com' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  return { app, mockPool, mockConnection, superadminToken, userToken };
}

describe('rbac feature', () => {
  test('GET /api/rbac/roles returns roles list', async () => {
    const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
    mockPool.query.mockResolvedValueOnce([[{ id: 1, name: 'superadmin' }], []]);

    const res = await request(app)
      .get('/api/rbac/roles')
      .set('Authorization', `Bearer ${superadminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/rbac/roles requires superadmin', async () => {
    const { app, userToken } = await loadAppWithMockedDb();
    const res = await request(app)
      .post('/api/rbac/roles')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'cashier' });
    expect(res.status).toBe(403);
  });

  test('POST /api/rbac/roles creates role', async () => {
    const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
    mockPool.query.mockResolvedValueOnce([{ insertId: 3 }, []]);

    const res = await request(app)
      .post('/api/rbac/roles')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ name: 'cashier' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(3);
  });

  test('GET /api/rbac/permissions missing params returns 400', async () => {
    const { app, superadminToken } = await loadAppWithMockedDb();
    const res = await request(app)
      .get('/api/rbac/permissions')
      .set('Authorization', `Bearer ${superadminToken}`);
    expect(res.status).toBe(400);
  });

  test('PUT /api/rbac/permissions bulk update returns 200', async () => {
    const { app, mockConnection, superadminToken } = await loadAppWithMockedDb();
    mockConnection.query.mockResolvedValue([{}, []]);

    const res = await request(app)
      .put('/api/rbac/permissions')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({
        roleId: 2,
        permissions: [{ module: 'Management Product', create: true, edit: false, delete: false, show: true }],
      });
    expect(res.status).toBe(200);
  });
});

