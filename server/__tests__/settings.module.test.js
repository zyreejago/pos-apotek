const express = require('express');
const request = require('supertest');

const registerSettingsRoutes = require('../routes/settings');

function buildApp({ pool }) {
  const app = express();
  app.use(express.json());

  const authenticate = (_req, _res, next) => next();
  registerSettingsRoutes(app, pool, authenticate);
  return app;
}

describe('settings module', () => {
  test('GET /api/settings returns settings map', async () => {
    const connection = {
      query: jest.fn().mockResolvedValueOnce([[{ setting_key: 'ppn_rate', setting_value: '0.11' }], []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(200);
    expect(res.body.ppn_rate).toBe('0.11');
  });

  test('GET /api/settings error returns 500', async () => {
    const pool = { getConnection: jest.fn().mockRejectedValueOnce(new Error('db')) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(500);
  });

  test('PUT /api/settings updates ppn_rate only', async () => {
    const connection = {
      query: jest.fn().mockResolvedValue([{}, []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).put('/api/settings').send({ ppn_rate: 0.11 });
    expect(res.status).toBe(200);
  });

  test('PUT /api/settings updates discount_rate only', async () => {
    const connection = {
      query: jest.fn().mockResolvedValue([{}, []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).put('/api/settings').send({ discount_rate: 0.05 });
    expect(res.status).toBe(200);
  });

  test('PUT /api/settings updates both', async () => {
    const connection = {
      query: jest.fn().mockResolvedValue([{}, []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).put('/api/settings').send({ ppn_rate: 0.11, discount_rate: 0.05 });
    expect(res.status).toBe(200);
  });

  test('PUT /api/settings with no fields still returns 200', async () => {
    const connection = {
      query: jest.fn().mockResolvedValue([{}, []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).put('/api/settings').send({});
    expect(res.status).toBe(200);
  });

  test('PUT /api/settings error returns 500', async () => {
    const pool = { getConnection: jest.fn().mockRejectedValueOnce(new Error('db')) };
    const app = buildApp({ pool });

    const res = await request(app).put('/api/settings').send({ ppn_rate: 0.11 });
    expect(res.status).toBe(500);
  });

  test('POST /api/settings creates a new setting', async () => {
    const connection = {
      query: jest.fn().mockResolvedValue([{ insertId: 1 }, []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/settings').send({ setting_key: 'test_key', setting_value: 'test_value' });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Setting created successfully');
  });

  test('POST /api/settings missing setting_key returns 400', async () => {
    const pool = { getConnection: jest.fn() };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/settings').send({ setting_value: 'test' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('setting_key and setting_value are required');
  });

  test('POST /api/settings missing setting_value returns 400', async () => {
    const pool = { getConnection: jest.fn() };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/settings').send({ setting_key: 'test_key' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('setting_key and setting_value are required');
  });

  test('POST /api/settings duplicate key returns 409', async () => {
    const connection = {
      query: jest.fn().mockRejectedValue({ code: 'ER_DUP_ENTRY' }),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/settings').send({ setting_key: 'dup_key', setting_value: 'val' });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Setting key already exists');
  });

  test('POST /api/settings error returns 500', async () => {
    const pool = { getConnection: jest.fn().mockRejectedValue(new Error('db')) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/settings').send({ setting_key: 'test', setting_value: 'val' });
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Server error');
  });

  test('PUT /api/settings/:key updates setting by key', async () => {
    const connection = {
      query: jest.fn().mockResolvedValue([{ affectedRows: 1 }, []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).put('/api/settings/test_key').send({ setting_value: 'new_value' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Setting updated successfully');
  });

  test('PUT /api/settings/:key missing setting_value returns 400', async () => {
    const app = buildApp({ pool: { getConnection: jest.fn() } });

    const res = await request(app).put('/api/settings/test_key').send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('setting_value is required');
  });

  test('PUT /api/settings/:key not found returns 404', async () => {
    const connection = {
      query: jest.fn().mockResolvedValue([{ affectedRows: 0 }, []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).put('/api/settings/nonexistent').send({ setting_value: 'val' });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Setting not found');
  });

  test('PUT /api/settings/:key error returns 500', async () => {
    const pool = { getConnection: jest.fn().mockRejectedValue(new Error('db')) };
    const app = buildApp({ pool });

    const res = await request(app).put('/api/settings/test_key').send({ setting_value: 'val' });
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Server error');
  });

  test('DELETE /api/settings/:key deletes setting', async () => {
    const connection = {
      query: jest.fn().mockResolvedValue([{ affectedRows: 1 }, []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).delete('/api/settings/test_key');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Setting deleted successfully');
  });

  test('DELETE /api/settings/:key not found returns 404', async () => {
    const connection = {
      query: jest.fn().mockResolvedValue([{ affectedRows: 0 }, []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).delete('/api/settings/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Setting not found');
  });

  test('DELETE /api/settings/:key error returns 500', async () => {
    const pool = { getConnection: jest.fn().mockRejectedValue(new Error('db')) };
    const app = buildApp({ pool });

    const res = await request(app).delete('/api/settings/test_key');
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Server error');
  });
});

