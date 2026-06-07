const request = require('supertest');
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

  const { app } = require('../index');
  return { app, mockPool };
}

describe('Auth Module - Register', () => {
  let logSpy, errorSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy?.mockRestore();
    errorSpy?.mockRestore();
  });

  test('register missing username/email/password returns 400', async () => {
    const { app } = await loadAppWithMockedDb();
    const res = await request(app).post('/api/register').send({ email: 'a@a.com' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('harus diisi');
  });

  test('register password mismatch returns 400', async () => {
    const { app } = await loadAppWithMockedDb();
    const res = await request(app).post('/api/register').send({
      username: 'u', email: 'u@u.com', password: '123456', confirmPassword: '654321',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('tidak cocok');
  });

  test('register password too short returns 400', async () => {
    const { app } = await loadAppWithMockedDb();
    const res = await request(app).post('/api/register').send({
      username: 'u', email: 'u@u.com', password: '123', confirmPassword: '123',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('minimal 6');
  });

  test('register success returns 201 with token', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    mockPool.query.mockResolvedValue([{ insertId: 123 }]);
    const res = await request(app).post('/api/register').send({
      username: 'newuser', email: 'new@test.com', password: 'password123', confirmPassword: 'password123',
    });
    expect(res.status).toBe(201);
    expect(res.body.user.id).toBe(123);
    expect(res.body.token).toBeDefined();
  });

  test('register duplicate entry returns 409', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    const err = new Error('Duplicate');
    err.code = 'ER_DUP_ENTRY';
    mockPool.query.mockRejectedValue(err);
    const res = await request(app).post('/api/register').send({
      username: 'dup', email: 'dup@test.com', password: 'password123', confirmPassword: 'password123',
    });
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('sudah digunakan');
  });

  test('register server error returns 500', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    mockPool.query.mockRejectedValue(new Error('DB fail'));
    const res = await request(app).post('/api/register').send({
      username: 'u', email: 'u@u.com', password: 'password123', confirmPassword: 'password123',
    });
    expect(res.status).toBe(500);
  });

  test('register empty username returns 400', async () => {
    const { app } = await loadAppWithMockedDb();
    const res = await request(app).post('/api/register').send({ password: '123456', confirmPassword: '123456' });
    expect(res.status).toBe(400);
  });
});

describe('Auth Module - Login', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('login invalid credentials (user not found) returns 401', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    mockPool.query.mockResolvedValue([[], []]);
    const res = await request(app).post('/api/login').send({ email: 'x@y.com', password: 'nope' });
    expect(res.status).toBe(401);
  });

  test('login inactive user returns 403', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    mockPool.query.mockResolvedValue([[{ id: 1, username: 'u', email: 'u@u.com', password: 'hash', status: 'inactive' }]]);
    const res = await request(app).post('/api/login').send({ email: 'u@u.com', password: 'nope' });
    expect(res.status).toBe(403);
    expect(res.body.message).toContain('inactive');
  });

  test('login wrong password returns 401', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    const hashed = await bcrypt.hash('correct', 10);
    mockPool.query.mockResolvedValue([[{ id: 1, username: 'u', email: 'u@u.com', password: hashed, status: 'active' }]]);
    const res = await request(app).post('/api/login').send({ email: 'u@u.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  test('login success returns 200 with token', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    const hashed = await bcrypt.hash('correct', 10);
    mockPool.query.mockResolvedValue([[{ id: 1, username: 'u', email: 'u@u.com', password: hashed, role: 'admin', status: 'active' }]]);
    const res = await request(app).post('/api/login').send({ email: 'u@u.com', password: 'correct' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('admin');
  });

  test('login server error returns 500', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    mockPool.query.mockRejectedValue(new Error('DB fail'));
    const res = await request(app).post('/api/login').send({ email: 'u@u.com', password: 'correct' });
    expect(res.status).toBe(500);
  });

  test('login without email returns 500 gracefully', async () => {
    const { app, mockPool } = await loadAppWithMockedDb();
    mockPool.query.mockRejectedValue(new Error('DB fail'));
    const res = await request(app).post('/api/login').send({});
    expect(res.status).toBe(500);
  });
});
