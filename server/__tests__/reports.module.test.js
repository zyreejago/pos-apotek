const express = require('express');
const request = require('supertest');

const registerReportRoutes = require('../routes/reports');

function buildApp({ pool }) {
  const app = express();
  app.use(express.json());

  const authenticate = (_req, _res, next) => next();
  const checkPermission = () => (_req, _res, next) => next();

  registerReportRoutes(app, pool, authenticate, checkPermission);
  return app;
}

describe('reports module', () => {
  test('GET /api/financial/profit-loss missing params returns 400', async () => {
    const pool = { getConnection: jest.fn() };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/financial/profit-loss');
    expect(res.status).toBe(400);
  });

  test('GET /api/financial/profit-loss returns report', async () => {
    const connection = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[{ total_sales: 1000 }], []])
        .mockResolvedValueOnce([[{ total_cogs: 200 }], []])
        .mockResolvedValueOnce([[{ opname_value: 50 }], []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/financial/profit-loss?month=1&year=2026');
    expect(res.status).toBe(200);
    expect(res.body.revenue.total).toBe(1000);
  });

  test('GET /api/financial/profit-loss handles null aggregates', async () => {
    const connection = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[{ total_sales: null }], []])
        .mockResolvedValueOnce([[{ total_cogs: null }], []])
        .mockResolvedValueOnce([[{ opname_value: null }], []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/financial/profit-loss?month=1&year=2026');
    expect(res.status).toBe(200);
    expect(res.body.revenue.total).toBe(0);
  });

  test('GET /api/financial/profit-loss error returns 500', async () => {
    const pool = { getConnection: jest.fn().mockRejectedValueOnce(new Error('db')) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/financial/profit-loss?month=1&year=2026');
    expect(res.status).toBe(500);
  });

  test('GET /api/reports/transactions missing params returns 400', async () => {
    const pool = { getConnection: jest.fn() };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/reports/transactions');
    expect(res.status).toBe(400);
  });

  test('GET /api/reports/transactions returns empty report when no transactions', async () => {
    const connection = {
      query: jest.fn().mockResolvedValueOnce([[], []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/reports/transactions?startDate=2026-01-01&endDate=2026-01-31');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.transactions)).toBe(true);
    expect(Array.isArray(res.body.chartData)).toBe(true);
  });

  test('GET /api/reports/transactions returns report with items', async () => {
    const connection = {
      query: jest
        .fn()
        .mockResolvedValueOnce([
          [
            { id: 1, transaction_date: new Date('2026-01-01').toISOString(), total_amount: 1000 },
            { id: 2, transaction_date: new Date('2026-01-02').toISOString(), total_amount: 2000 },
          ],
          [],
        ])
        .mockResolvedValueOnce([
          [
            { transaction_id: 1, quantity: 1, price: 1000, product_name: 'A' },
            { transaction_id: 2, quantity: 2, price: 1000, product_name: 'B' },
          ],
          [],
        ]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/reports/transactions?startDate=2026-01-01&endDate=2026-01-31');
    expect(res.status).toBe(200);
    expect(res.body.transactions.length).toBe(2);
  });

  test('GET /api/reports/transactions aggregates totals for same date', async () => {
    const connection = {
      query: jest
        .fn()
        .mockResolvedValueOnce([
          [
            { id: 1, transaction_date: new Date('2026-01-01').toISOString(), total_amount: 1000 },
            { id: 2, transaction_date: new Date('2026-01-01').toISOString(), total_amount: 2000 },
          ],
          [],
        ])
        .mockResolvedValueOnce([
          [
            { transaction_id: 1, quantity: 1, price: 1000, product_name: 'A' },
            { transaction_id: 2, quantity: 2, price: 1000, product_name: 'B' },
          ],
          [],
        ]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/reports/transactions?startDate=2026-01-01&endDate=2026-01-31');
    expect(res.status).toBe(200);
    expect(res.body.chartData[0].total).toBe(3000);
  });

  test('GET /api/reports/transactions error returns 500', async () => {
    const pool = { getConnection: jest.fn().mockRejectedValueOnce(new Error('db')) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/reports/transactions?startDate=2026-01-01&endDate=2026-01-31');
    expect(res.status).toBe(500);
  });

  test('GET /api/reports/balance returns balance sheet', async () => {
    const connection = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[{ total_cash: 1000 }], []])
        .mockResolvedValueOnce([[{ total_inventory: 500 }], []])
        .mockResolvedValueOnce([[{ total_cogs: 200 }], []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/reports/balance');
    expect(res.status).toBe(200);
    expect(res.body.assets.total).toBe(1500);
  });

  test('GET /api/reports/balance handles null aggregates', async () => {
    const connection = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[{ total_cash: null }], []])
        .mockResolvedValueOnce([[{ total_inventory: null }], []])
        .mockResolvedValueOnce([[{ total_cogs: null }], []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/reports/balance');
    expect(res.status).toBe(200);
    expect(res.body.assets.total).toBe(0);
  });

  test('GET /api/reports/balance error returns 500', async () => {
    const pool = { getConnection: jest.fn().mockRejectedValueOnce(new Error('db')) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/reports/balance');
    expect(res.status).toBe(500);
  });
});
