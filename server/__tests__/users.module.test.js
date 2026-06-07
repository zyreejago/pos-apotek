const express = require('express');
const request = require('supertest');

const registerUserRoutes = require('../routes/users');

function buildApp({ pool, bcrypt, user }) {
  const app = express();
  app.use(express.json());

  const authenticate = (req, _res, next) => {
    req.user = user || { id: 1, role: 'superadmin' };
    next();
  };

  const checkPermission = () => (_req, _res, next) => next();
  const createAuditTrail = jest.fn().mockResolvedValue(undefined);

  registerUserRoutes(app, pool, bcrypt, authenticate, checkPermission, createAuditTrail);
  return app;
}

describe('users module', () => {
  test('GET /api/users without search returns list', async () => {
    const connection = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[{ id: 1, username: 'u' }], []])
        .mockResolvedValueOnce([[{ total: 1 }], []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool, bcrypt: {}, user: { id: 1, role: 'superadmin' } });

    const res = await request(app).get('/api/users?page=1&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(1);
  });

  test('GET /api/users with search returns list', async () => {
    const connection = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[{ id: 1, username: 'u' }], []])
        .mockResolvedValueOnce([[{ total: 1 }], []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool, bcrypt: {}, user: { id: 1, role: 'superadmin' } });

    const res = await request(app).get('/api/users?page=1&limit=10&search=a');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /api/users error returns 500', async () => {
    const pool = { getConnection: jest.fn().mockRejectedValue(new Error('db')) };
    const app = buildApp({ pool, bcrypt: {}, user: { id: 1, role: 'superadmin' } });

    const res = await request(app).get('/api/users');
    expect(res.status).toBe(500);
  });

  test('POST /api/users validation returns 400', async () => {
    const pool = { query: jest.fn() };
    const app = buildApp({ pool, bcrypt: {}, user: { id: 1, role: 'superadmin' } });

    const res = await request(app).post('/api/users').send({ username: 'u' });
    expect(res.status).toBe(400);
  });

  test('POST /api/users cannot create superadmin returns 403', async () => {
    const pool = { query: jest.fn() };
    const bcrypt = { hash: jest.fn() };
    const app = buildApp({ pool, bcrypt, user: { id: 2, role: 'user' } });

    const res = await request(app).post('/api/users').send({
      username: 'u',
      email: 'u@u.com',
      password: '123456',
      role: 'superadmin',
      status: 'active',
    });
    expect(res.status).toBe(403);
  });

  test('POST /api/users success returns 201', async () => {
    const pool = { query: jest.fn().mockResolvedValueOnce([{ insertId: 10 }, []]) };
    const bcrypt = { hash: jest.fn().mockResolvedValue('hash') };
    const app = buildApp({ pool, bcrypt, user: { id: 1, role: 'superadmin' } });

    const res = await request(app).post('/api/users').send({
      username: 'u',
      email: 'u@u.com',
      password: '123456',
      role: 'user',
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(10);
    expect(res.body.status).toBe('active');
  });

  test('POST /api/users duplicate returns 409', async () => {
    const err = new Error('dup');
    err.code = 'ER_DUP_ENTRY';
    const pool = { query: jest.fn().mockRejectedValueOnce(err) };
    const bcrypt = { hash: jest.fn().mockResolvedValue('hash') };
    const app = buildApp({ pool, bcrypt, user: { id: 1, role: 'superadmin' } });

    const res = await request(app).post('/api/users').send({
      username: 'u',
      email: 'u@u.com',
      password: '123456',
      role: 'user',
    });
    expect(res.status).toBe(409);
  });

  test('POST /api/users error returns 500', async () => {
    const pool = { query: jest.fn().mockRejectedValueOnce(new Error('fail')) };
    const bcrypt = { hash: jest.fn().mockResolvedValue('hash') };
    const app = buildApp({ pool, bcrypt, user: { id: 1, role: 'superadmin' } });

    const res = await request(app).post('/api/users').send({
      username: 'u',
      email: 'u@u.com',
      password: '123456',
      role: 'user',
    });
    expect(res.status).toBe(500);
  });

  test('PUT /api/users/:id invalid id returns 400', async () => {
    const pool = { query: jest.fn() };
    const app = buildApp({ pool, bcrypt: {}, user: { id: 1, role: 'superadmin' } });

    const res = await request(app).put('/api/users/0').send({});
    expect(res.status).toBe(400);
  });

  test('PUT /api/users/:id not found returns 404', async () => {
    const pool = { query: jest.fn().mockResolvedValueOnce([[], []]) };
    const app = buildApp({ pool, bcrypt: {}, user: { id: 1, role: 'superadmin' } });

    const res = await request(app).put('/api/users/1').send({ username: 'u', email: 'e', role: 'user' });
    expect(res.status).toBe(404);
  });

  test('PUT /api/users/:id cannot modify superadmin returns 403', async () => {
    const pool = { query: jest.fn().mockResolvedValueOnce([[{ id: 1, role: 'superadmin' }], []]) };
    const app = buildApp({ pool, bcrypt: {}, user: { id: 2, role: 'user' } });

    const res = await request(app).put('/api/users/1').send({ username: 'u', email: 'e', role: 'user' });
    expect(res.status).toBe(403);
  });

  test('PUT /api/users/:id cannot promote to superadmin returns 403', async () => {
    const pool = { query: jest.fn().mockResolvedValueOnce([[{ id: 1, role: 'user' }], []]) };
    const app = buildApp({ pool, bcrypt: {}, user: { id: 2, role: 'user' } });

    const res = await request(app).put('/api/users/1').send({ username: 'u', email: 'e', role: 'superadmin' });
    expect(res.status).toBe(403);
  });

  test('PUT /api/users/:id updates without password returns 200', async () => {
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[{ id: 1, role: 'user' }], []])
        .mockResolvedValueOnce([{}, []]),
    };
    const bcrypt = { hash: jest.fn() };
    const app = buildApp({ pool, bcrypt, user: { id: 1, role: 'superadmin' } });

    const res = await request(app).put('/api/users/1').send({ username: 'u', email: 'e', role: 'user', status: 'active' });
    expect(res.status).toBe(200);
  });

  test('PUT /api/users/:id updates with password returns 200', async () => {
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[{ id: 1, role: 'user' }], []])
        .mockResolvedValueOnce([{}, []]),
    };
    const bcrypt = { hash: jest.fn().mockResolvedValue('hash') };
    const app = buildApp({ pool, bcrypt, user: { id: 1, role: 'superadmin' } });

    const res = await request(app)
      .put('/api/users/1')
      .send({ username: 'u', email: 'e', role: 'user', status: 'active', password: '123456' });
    expect(res.status).toBe(200);
  });

  test('PUT /api/users/:id duplicate returns 409', async () => {
    const err = new Error('dup');
    err.code = 'ER_DUP_ENTRY';
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[{ id: 1, role: 'user' }], []])
        .mockRejectedValueOnce(err),
    };
    const app = buildApp({ pool, bcrypt: {}, user: { id: 1, role: 'superadmin' } });

    const res = await request(app).put('/api/users/1').send({ username: 'u', email: 'e', role: 'user' });
    expect(res.status).toBe(409);
  });

  test('PUT /api/users/:id error returns 500', async () => {
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[{ id: 1, role: 'user' }], []])
        .mockRejectedValueOnce(new Error('fail')),
    };
    const app = buildApp({ pool, bcrypt: {}, user: { id: 1, role: 'superadmin' } });

    const res = await request(app).put('/api/users/1').send({ username: 'u', email: 'e', role: 'user' });
    expect(res.status).toBe(500);
  });

  test('DELETE /api/users/:id prevents deleting self returns 403', async () => {
    const pool = { query: jest.fn() };
    const app = buildApp({ pool, bcrypt: {}, user: { id: 1, role: 'superadmin' } });

    const res = await request(app).delete('/api/users/1');
    expect(res.status).toBe(403);
  });

  test('DELETE /api/users/:id not found returns 404', async () => {
    const pool = { query: jest.fn().mockResolvedValueOnce([[], []]) };
    const app = buildApp({ pool, bcrypt: {}, user: { id: 1, role: 'superadmin' } });

    const res = await request(app).delete('/api/users/2');
    expect(res.status).toBe(404);
  });

  test('DELETE /api/users/:id cannot delete superadmin returns 403', async () => {
    const pool = { query: jest.fn().mockResolvedValueOnce([[{ role: 'superadmin' }], []]) };
    const app = buildApp({ pool, bcrypt: {}, user: { id: 2, role: 'user' } });

    const res = await request(app).delete('/api/users/3');
    expect(res.status).toBe(403);
  });

  test('DELETE /api/users/:id affectedRows 0 returns 404', async () => {
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[{ role: 'user' }], []])
        .mockResolvedValueOnce([{ affectedRows: 0 }, []]),
    };
    const app = buildApp({ pool, bcrypt: {}, user: { id: 1, role: 'superadmin' } });

    const res = await request(app).delete('/api/users/3');
    expect(res.status).toBe(404);
  });

  test('DELETE /api/users/:id success returns 200', async () => {
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[{ role: 'user' }], []])
        .mockResolvedValueOnce([{ affectedRows: 1 }, []]),
    };
    const app = buildApp({ pool, bcrypt: {}, user: { id: 1, role: 'superadmin' } });

    const res = await request(app).delete('/api/users/3');
    expect(res.status).toBe(200);
  });

  test('DELETE /api/users/:id error returns 500', async () => {
    const pool = { query: jest.fn().mockRejectedValueOnce(new Error('fail')) };
    const app = buildApp({ pool, bcrypt: {}, user: { id: 1, role: 'superadmin' } });

    const res = await request(app).delete('/api/users/3');
    expect(res.status).toBe(500);
  });
});
