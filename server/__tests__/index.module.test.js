const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

async function loadAppWithMockedDb() {
  process.env.JWT_SECRET = 'test_jwt_secret';

  jest.resetModules();

  const mockPool = {
    query: jest.fn(),
    getConnection: jest.fn(),
  };

  jest.doMock('../db', () => ({
    pool: mockPool,
    initDB: jest.fn().mockResolvedValue(undefined),
  }));

  const { app, startServer } = require('../index');
  return { app, mockPool, startServer };
}

describe('index.js module', () => {
  let logSpy;
  let errorSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy?.mockRestore();
    errorSpy?.mockRestore();
  });

  test('GET / returns health message', async () => {
    const { app } = await loadAppWithMockedDb();
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('API is running');
  });

  test('POST /api/register missing fields returns 400', async () => {
    const { app } = await loadAppWithMockedDb();
    const res = await request(app).post('/api/register').send({ email: 'a@a.com' });
    expect(res.status).toBe(400);
  });

  test('POST /api/register password mismatch returns 400', async () => {
    const { app } = await loadAppWithMockedDb();
    const res = await request(app).post('/api/register').send({
      username: 'u',
      email: 'u@u.com',
      password: '123456',
      confirmPassword: '654321',
    });
    expect(res.status).toBe(400);
  });

  test('POST /api/register password too short returns 400', async () => {
    const { app } = await loadAppWithMockedDb();
    const res = await request(app).post('/api/register').send({
      username: 'u',
      email: 'u@u.com',
      password: '123',
      confirmPassword: '123',
    });
    expect(res.status).toBe(400);
  });

  test('POST /api/register success returns 201', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    mockPool.query.mockResolvedValueOnce([{ insertId: 123 }, []]);
    const res = await request(app).post('/api/register').send({
      username: 'testuser',
      email: 'test@test.com',
      password: 'password123',
      confirmPassword: 'password123',
    });
    expect(res.status).toBe(201);
    expect(res.body.user.id).toBe(123);
    expect(res.body.token).toBeDefined();
  });

  test('POST /api/register duplicate entry returns 409', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    const err = new Error('Duplicate');
    err.code = 'ER_DUP_ENTRY';
    mockPool.query.mockRejectedValueOnce(err);
    const res = await request(app).post('/api/register').send({
      username: 'testuser',
      email: 'test@test.com',
      password: 'password123',
      confirmPassword: 'password123',
    });
    expect(res.status).toBe(409);
  });

  test('POST /api/register server error returns 500', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    mockPool.query.mockRejectedValueOnce(new Error('DB fail'));
    const res = await request(app).post('/api/register').send({
      username: 'testuser',
      email: 'test@test.com',
      password: 'password123',
      confirmPassword: 'password123',
    });
    expect(res.status).toBe(500);
  });

  test('POST /api/login invalid credentials returns 401', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    mockPool.query.mockResolvedValueOnce([[], []]);
    const res = await request(app).post('/api/login').send({ email: 'x@y.com', password: 'nope' });
    expect(res.status).toBe(401);
  });

  test('POST /api/login inactive user returns 403', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    mockPool.query.mockResolvedValueOnce([[{ id: 1, username: 'u', email: 'u@u.com', password: 'hash', status: 'inactive' }], []]);
    const res = await request(app).post('/api/login').send({ email: 'u@u.com', password: 'nope' });
    expect(res.status).toBe(403);
  });

  test('POST /api/login wrong password returns 401', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    const hashedPassword = await bcrypt.hash('correct', 10);
    mockPool.query.mockResolvedValueOnce([[{ id: 1, username: 'u', email: 'u@u.com', password: hashedPassword, status: 'active' }], []]);
    const res = await request(app).post('/api/login').send({ email: 'u@u.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  test('POST /api/login success returns 200 with token', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    const hashedPassword = await bcrypt.hash('correct', 10);
    mockPool.query.mockResolvedValueOnce([[{ id: 1, username: 'u', email: 'u@u.com', password: hashedPassword, role: 'user', status: 'active' }], []]);
    const res = await request(app).post('/api/login').send({ email: 'u@u.com', password: 'correct' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('POST /api/login server error returns 500', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    mockPool.query.mockRejectedValueOnce(new Error('DB fail'));
    const res = await request(app).post('/api/login').send({ email: 'u@u.com', password: 'correct' });
    expect(res.status).toBe(500);
  });

  test('GET /api/rbac/modules without token returns 401', async () => {
    const { app } = await loadAppWithMockedDb();
    const res = await request(app).get('/api/rbac/modules');
    expect(res.status).toBe(401);
  });

  test('GET /api/rbac/modules with invalid token returns 401', async () => {
    const { app } = await loadAppWithMockedDb();
    const res = await request(app).get('/api/rbac/modules').set('Authorization', 'Bearer invalidtoken');
    expect(res.status).toBe(401);
  });

  test('GET /api/rbac/modules with valid token returns modules', async () => {
    const { app } = await loadAppWithMockedDb();
    const token = jwt.sign(
      { id: 1, username: 'admin', role: 'superadmin', email: 'admin@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await request(app).get('/api/rbac/modules').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/rbac/roles returns roles', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    mockPool.query.mockResolvedValueOnce([[{ id: 1, name: 'user' }, { id: 2, name: 'admin' }], []]);
    const token = jwt.sign(
      { id: 1, username: 'admin', role: 'superadmin', email: 'admin@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await request(app).get('/api/rbac/roles').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('GET /api/rbac/roles server error returns 500', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    mockPool.query.mockRejectedValueOnce(new Error('DB fail'));
    const token = jwt.sign(
      { id: 1, username: 'admin', role: 'superadmin', email: 'admin@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await request(app).get('/api/rbac/roles').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(500);
  });

  test('POST /api/rbac/roles requires name', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    const token = jwt.sign(
      { id: 1, username: 'admin', role: 'superadmin', email: 'admin@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await request(app).post('/api/rbac/roles').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(400);
  });

  test('POST /api/rbac/roles creates role', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    mockPool.query.mockResolvedValueOnce([{ insertId: 5 }, []]);
    const token = jwt.sign(
      { id: 1, username: 'admin', role: 'superadmin', email: 'admin@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await request(app).post('/api/rbac/roles').set('Authorization', `Bearer ${token}`).send({ name: 'testrole' });
    expect(res.status).toBe(201);
  });

  test('POST /api/rbac/roles duplicate returns 409', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    const err = new Error('Duplicate');
    err.code = 'ER_DUP_ENTRY';
    mockPool.query.mockRejectedValueOnce(err);
    const token = jwt.sign(
      { id: 1, username: 'admin', role: 'superadmin', email: 'admin@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await request(app).post('/api/rbac/roles').set('Authorization', `Bearer ${token}`).send({ name: 'testrole' });
    expect(res.status).toBe(409);
  });

  test('POST /api/rbac/roles server error returns 500', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    mockPool.query.mockRejectedValueOnce(new Error('DB fail'));
    const token = jwt.sign(
      { id: 1, username: 'admin', role: 'superadmin', email: 'admin@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await request(app).post('/api/rbac/roles').set('Authorization', `Bearer ${token}`).send({ name: 'testrole' });
    expect(res.status).toBe(500);
  });

  test('DELETE /api/rbac/roles/:id invalid id returns 400', async () => {
    const { app } = await loadAppWithMockedDb();
    const token = jwt.sign(
      { id: 1, username: 'admin', role: 'superadmin', email: 'admin@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await request(app).delete('/api/rbac/roles/0').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  test('DELETE /api/rbac/roles/:id not found returns 404', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    mockPool.query.mockResolvedValueOnce([[], []]);
    const token = jwt.sign(
      { id: 1, username: 'admin', role: 'superadmin', email: 'admin@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await request(app).delete('/api/rbac/roles/999').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test('DELETE /api/rbac/roles/:id cannot delete superadmin returns 403', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    mockPool.query.mockResolvedValueOnce([[{ name: 'superadmin' }], []]);
    const token = jwt.sign(
      { id: 1, username: 'admin', role: 'superadmin', email: 'admin@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await request(app).delete('/api/rbac/roles/1').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('DELETE /api/rbac/roles/:id success returns 200', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    mockPool.query
      .mockResolvedValueOnce([[{ name: 'testrole' }], []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([{}, []]);
    const token = jwt.sign(
      { id: 1, username: 'admin', role: 'superadmin', email: 'admin@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await request(app).delete('/api/rbac/roles/2').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('DELETE /api/rbac/roles/:id server error returns 500', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    mockPool.query.mockRejectedValueOnce(new Error('DB fail'));
    const token = jwt.sign(
      { id: 1, username: 'admin', role: 'superadmin', email: 'admin@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await request(app).delete('/api/rbac/roles/2').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(500);
  });

  test('GET /api/rbac/permissions requires roleId or roleName', async () => {
    const { app } = await loadAppWithMockedDb();
    const token = jwt.sign(
      { id: 1, username: 'admin', role: 'superadmin', email: 'admin@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await request(app).get('/api/rbac/permissions').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  test('GET /api/rbac/permissions by roleName not found returns defaults', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    mockPool.query.mockResolvedValueOnce([[], []]);
    const token = jwt.sign(
      { id: 1, username: 'admin', role: 'superadmin', email: 'admin@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await request(app).get('/api/rbac/permissions?roleName=nonexistent').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('GET /api/rbac/permissions by roleName exists returns permissions', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    mockPool.query
      .mockResolvedValueOnce([[{ id: 2 }], []])
      .mockResolvedValueOnce([[{ module: 'Management Product', action: 'show', allowed: 1 }], []]);
    const token = jwt.sign(
      { id: 1, username: 'admin', role: 'superadmin', email: 'admin@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await request(app).get('/api/rbac/permissions?roleName=user').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('GET /api/rbac/permissions by roleId returns permissions', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    mockPool.query.mockResolvedValueOnce([[{ module: 'Management Product', action: 'show', allowed: 1 }], []]);
    const token = jwt.sign(
      { id: 1, username: 'admin', role: 'superadmin', email: 'admin@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await request(app).get('/api/rbac/permissions?roleId=1').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('GET /api/rbac/permissions server error returns 500', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    mockPool.query.mockRejectedValueOnce(new Error('DB fail'));
    const token = jwt.sign(
      { id: 1, username: 'admin', role: 'superadmin', email: 'admin@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await request(app).get('/api/rbac/permissions?roleId=1').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(500);
  });

  test('PUT /api/rbac/permissions bulk requires roleId', async () => {
    const { app } = await loadAppWithMockedDb();
    const token = jwt.sign(
      { id: 1, username: 'admin', role: 'superadmin', email: 'admin@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await request(app).put('/api/rbac/permissions').set('Authorization', `Bearer ${token}`).send({ permissions: [] });
    expect(res.status).toBe(400);
  });

  test('PUT /api/rbac/permissions bulk update success', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    const mockConnection = {
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
      query: jest.fn(),
    };
    mockPool.getConnection.mockResolvedValue(mockConnection);
    const token = jwt.sign(
      { id: 1, username: 'admin', role: 'superadmin', email: 'admin@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await request(app).put('/api/rbac/permissions').set('Authorization', `Bearer ${token}`).send({
      roleId: 1,
      permissions: [{ module: 'Management Product', create: true, edit: false, delete: false, show: true }]
    });
    expect(res.status).toBe(200);
  });

  test('PUT /api/rbac/permissions bulk update error rolls back', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    const mockConnection = {
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
      query: jest.fn().mockRejectedValueOnce(new Error('DB fail')),
    };
    mockPool.getConnection.mockResolvedValue(mockConnection);
    const token = jwt.sign(
      { id: 1, username: 'admin', role: 'superadmin', email: 'admin@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await request(app).put('/api/rbac/permissions').set('Authorization', `Bearer ${token}`).send({
      roleId: 1,
      permissions: [{ module: 'Management Product', create: true, edit: false, delete: false, show: true }]
    });
    expect(res.status).toBe(500);
  });

  test('PUT /api/rbac/permissions single update requires roleId, module, action', async () => {
    const { app } = await loadAppWithMockedDb();
    const token = jwt.sign(
      { id: 1, username: 'admin', role: 'superadmin', email: 'admin@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await request(app).put('/api/rbac/permissions').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(400);
  });

  test('PUT /api/rbac/permissions single update success', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    mockPool.query.mockResolvedValueOnce([{}, []]);
    const token = jwt.sign(
      { id: 1, username: 'admin', role: 'superadmin', email: 'admin@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await request(app).put('/api/rbac/permissions').set('Authorization', `Bearer ${token}`).send({
      roleId: 1,
      module: 'Management Product',
      action: 'show',
      allowed: true
    });
    expect(res.status).toBe(200);
  });

  test('PUT /api/rbac/permissions single update server error returns 500', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    mockPool.query.mockRejectedValueOnce(new Error('DB fail'));
    const token = jwt.sign(
      { id: 1, username: 'admin', role: 'superadmin', email: 'admin@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await request(app).put('/api/rbac/permissions').set('Authorization', `Bearer ${token}`).send({
      roleId: 1,
      module: 'Management Product',
      action: 'show',
      allowed: true
    });
    expect(res.status).toBe(500);
  });

  test('startServer works', async () => {
    const { startServer } = await loadAppWithMockedDb();
    const server = await startServer();
    expect(server).toBeDefined();
    server.close();
  });

  test('checkPermission for non-superadmin works', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    mockPool.query
      .mockResolvedValueOnce([[{ id: 2 }], []])
      .mockResolvedValueOnce([[{ allowed: 1 }], []])
      .mockResolvedValueOnce([[{ id: 1, name: 'Paracetamol', stock: 10, unit: 'pcs' }], []]);
    const token = jwt.sign(
      { id: 1, username: 'user', role: 'user', email: 'user@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await request(app).get('/api/forecast/products').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('checkPermission for non-superadmin role not found returns 403', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    mockPool.query.mockResolvedValueOnce([[], []]);
    const token = jwt.sign(
      { id: 1, username: 'user', role: 'nonexistent', email: 'user@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await request(app).get('/api/forecast/products').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('checkPermission for non-superadmin permission not allowed returns 403', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    mockPool.query
      .mockResolvedValueOnce([[{ id: 2 }], []])
      .mockResolvedValueOnce([[], []]);
    const token = jwt.sign(
      { id: 1, username: 'user', role: 'user', email: 'user@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await request(app).get('/api/forecast/products').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('checkPermission server error returns 500', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    mockPool.query.mockRejectedValueOnce(new Error('DB fail'));
    const token = jwt.sign(
      { id: 1, username: 'user', role: 'user', email: 'user@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await request(app).get('/api/forecast/products').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(500);
  });
});
