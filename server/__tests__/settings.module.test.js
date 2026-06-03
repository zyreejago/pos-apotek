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
});

