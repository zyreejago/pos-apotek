const express = require('express');
const request = require('supertest');

const registerProfileRoutes = require('../routes/profile');

function buildApp({ pool, bcrypt, user }) {
  const app = express();
  app.use(express.json());

  const authenticate = (req, _res, next) => {
    req.user = user || { id: 1, role: 'superadmin' };
    next();
  };

  registerProfileRoutes(app, pool, bcrypt, authenticate);
  return app;
}

describe('profile module', () => {
  test('GET /api/profile returns 404 when user not found', async () => {
    const pool = { query: jest.fn().mockResolvedValueOnce([[], []]) };
    const app = buildApp({ pool, bcrypt: {}, user: { id: 1, role: 'user' } });

    const res = await request(app).get('/api/profile');
    expect(res.status).toBe(404);
  });

  test('GET /api/profile returns 200 when found', async () => {
    const pool = { query: jest.fn().mockResolvedValueOnce([[{ id: 1, username: 'u', email: 'e', role: 'user' }], []]) };
    const app = buildApp({ pool, bcrypt: {}, user: { id: 1, role: 'user' } });

    const res = await request(app).get('/api/profile');
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('u');
  });

  test('GET /api/profile error returns 500', async () => {
    const pool = { query: jest.fn().mockRejectedValueOnce(new Error('db')) };
    const app = buildApp({ pool, bcrypt: {}, user: { id: 1, role: 'user' } });

    const res = await request(app).get('/api/profile');
    expect(res.status).toBe(500);
  });

  test('PUT /api/profile missing fields returns 400', async () => {
    const pool = { query: jest.fn() };
    const app = buildApp({ pool, bcrypt: {}, user: { id: 1, role: 'user' } });

    const res = await request(app).put('/api/profile').send({ username: 'u' });
    expect(res.status).toBe(400);
  });

  test('PUT /api/profile existing username/email returns 409', async () => {
    const pool = { query: jest.fn().mockResolvedValueOnce([[{ id: 2 }], []]) };
    const app = buildApp({ pool, bcrypt: {}, user: { id: 1, role: 'user' } });

    const res = await request(app).put('/api/profile').send({ username: 'u', email: 'e' });
    expect(res.status).toBe(409);
  });

  test('PUT /api/profile success returns 200', async () => {
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([{}, []]),
    };
    const app = buildApp({ pool, bcrypt: {}, user: { id: 1, role: 'user' } });

    const res = await request(app).put('/api/profile').send({ username: 'u', email: 'e' });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('e');
  });

  test('PUT /api/profile error returns 500', async () => {
    const pool = { query: jest.fn().mockRejectedValueOnce(new Error('db')) };
    const app = buildApp({ pool, bcrypt: {}, user: { id: 1, role: 'user' } });

    const res = await request(app).put('/api/profile').send({ username: 'u', email: 'e' });
    expect(res.status).toBe(500);
  });

  test('PUT /api/profile/password missing fields returns 400', async () => {
    const pool = { query: jest.fn() };
    const app = buildApp({ pool, bcrypt: {}, user: { id: 1, role: 'user' } });

    const res = await request(app).put('/api/profile/password').send({ oldPassword: 'a' });
    expect(res.status).toBe(400);
  });

  test('PUT /api/profile/password short new password returns 400', async () => {
    const pool = { query: jest.fn() };
    const app = buildApp({ pool, bcrypt: {}, user: { id: 1, role: 'user' } });

    const res = await request(app).put('/api/profile/password').send({ oldPassword: 'a', newPassword: '123' });
    expect(res.status).toBe(400);
  });

  test('PUT /api/profile/password user not found returns 404', async () => {
    const pool = { query: jest.fn().mockResolvedValueOnce([[], []]) };
    const bcrypt = { compare: jest.fn(), hash: jest.fn() };
    const app = buildApp({ pool, bcrypt, user: { id: 1, role: 'user' } });

    const res = await request(app).put('/api/profile/password').send({ oldPassword: 'a', newPassword: '123456' });
    expect(res.status).toBe(404);
  });

  test('PUT /api/profile/password wrong old password returns 400', async () => {
    const pool = { query: jest.fn().mockResolvedValueOnce([[{ password: 'hash' }], []]) };
    const bcrypt = { compare: jest.fn().mockResolvedValue(false), hash: jest.fn() };
    const app = buildApp({ pool, bcrypt, user: { id: 1, role: 'user' } });

    const res = await request(app).put('/api/profile/password').send({ oldPassword: 'a', newPassword: '123456' });
    expect(res.status).toBe(400);
  });

  test('PUT /api/profile/password success returns 200', async () => {
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[{ password: 'hash' }], []])
        .mockResolvedValueOnce([{}, []]),
    };
    const bcrypt = { compare: jest.fn().mockResolvedValue(true), hash: jest.fn().mockResolvedValue('newhash') };
    const app = buildApp({ pool, bcrypt, user: { id: 1, role: 'user' } });

    const res = await request(app).put('/api/profile/password').send({ oldPassword: 'a', newPassword: '123456' });
    expect(res.status).toBe(200);
  });

  test('PUT /api/profile/password error returns 500', async () => {
    const pool = { query: jest.fn().mockRejectedValueOnce(new Error('db')) };
    const app = buildApp({ pool, bcrypt: {}, user: { id: 1, role: 'user' } });

    const res = await request(app).put('/api/profile/password').send({ oldPassword: 'a', newPassword: '123456' });
    expect(res.status).toBe(500);
  });
});

