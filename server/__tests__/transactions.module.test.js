jest.mock('midtrans-client', () => {
  class Snap {
    constructor() {
      this.transaction = {
        status: (...args) => Snap._status(...args),
      };
    }
    createTransaction(parameter) {
      return Snap._create(parameter);
    }
  }
  Snap._status = jest.fn();
  Snap._create = jest.fn();
  return { Snap };
});

const express = require('express');
const request = require('supertest');

const midtransClient = require('midtrans-client');
const registerTransactionRoutes = require('../routes/transactions');

function buildApp({ pool, user }) {
  const app = express();
  app.use(express.json());

  const authenticate = (req, _res, next) => {
    req.user = user || { id: 1, role: 'superadmin' };
    next();
  };
  const checkPermission = () => (_req, _res, next) => next();

  registerTransactionRoutes(app, pool, authenticate, checkPermission);
  return app;
}

function buildConnection() {
  return {
    query: jest.fn(),
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    release: jest.fn(),
  };
}

describe('transactions module', () => {
  beforeEach(() => {
    midtransClient.Snap._status.mockReset();
    midtransClient.Snap._create.mockReset();
  });

  test('POST /api/transactions missing items returns 400', async () => {
    const pool = { getConnection: jest.fn() };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/transactions').send({ items: [] });
    expect(res.status).toBe(400);
  });

  test('POST /api/transactions cash flow returns 201', async () => {
    const connection = buildConnection();
    connection.query
      .mockResolvedValueOnce([{ insertId: 10 }, []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([{}, []]);

    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/transactions').send({
      items: [{ id: 1, quantity: 2, price: 5000 }],
      total_amount: 10000,
      payment_method: 'cash',
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(10);
  });

  test('POST /api/transactions defaults optional fields when payment_method missing', async () => {
    const connection = buildConnection();
    connection.query
      .mockResolvedValueOnce([{ insertId: 12 }, []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([{}, []]);

    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/transactions').send({
      items: [{ id: 1, quantity: 1, price: 1000 }],
      total_amount: 1000,
      tax_amount: 1,
      discount_amount: 2,
      subtotal: 3,
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(12);
  });

  test('POST /api/transactions midtrans flow returns redirect_url', async () => {
    const connection = buildConnection();
    connection.query.mockResolvedValueOnce([{ insertId: 11 }, []]);
    midtransClient.Snap._create.mockResolvedValueOnce({ redirect_url: 'https://example.com' });

    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/transactions').send({
      items: [{ id: 1, quantity: 2, price: 5000 }],
      total_amount: 10000,
      payment_method: 'midtrans',
    });
    expect(res.status).toBe(201);
    expect(res.body.redirect_url).toContain('https://');
  });

  test('POST /api/transactions error triggers rollback returns 500', async () => {
    const connection = buildConnection();
    connection.query.mockRejectedValueOnce(new Error('db'));

    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/transactions').send({
      items: [{ id: 1, quantity: 2, price: 5000 }],
      total_amount: 10000,
      payment_method: 'cash',
    });
    expect(res.status).toBe(500);
  });

  test('GET /api/midtrans/status/:orderId not found returns 404', async () => {
    const connection = buildConnection();
    connection.query.mockResolvedValueOnce([[], []]);
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/midtrans/status/ORDER-1');
    expect(res.status).toBe(404);
  });

  test('GET /api/midtrans/status/:orderId capture challenge -> pending', async () => {
    const connection = buildConnection();
    connection.query
      .mockResolvedValueOnce([[{ id: 1, payment_status: 'pending' }], []])
      .mockResolvedValueOnce([{}, []]);

    midtransClient.Snap._status.mockResolvedValueOnce({ transaction_status: 'capture', fraud_status: 'challenge' });

    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/midtrans/status/ORDER-2');
    expect(res.status).toBe(200);
    expect(res.body.payment_status).toBe('pending');
  });

  test('GET /api/midtrans/status/:orderId capture accept -> completed', async () => {
    const connection = buildConnection();
    connection.query
      .mockResolvedValueOnce([[{ id: 2, payment_status: 'pending' }], []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([[], []]);

    midtransClient.Snap._status.mockResolvedValueOnce({ transaction_status: 'capture', fraud_status: 'accept' });

    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/midtrans/status/ORDER-3');
    expect(res.status).toBe(200);
    expect(res.body.payment_status).toBe('completed');
  });

  test('GET /api/midtrans/status/:orderId capture other fraud keeps original status', async () => {
    const connection = buildConnection();
    connection.query
      .mockResolvedValueOnce([[{ id: 20, payment_status: 'pending' }], []])
      .mockResolvedValueOnce([{}, []]);

    midtransClient.Snap._status.mockResolvedValueOnce({ transaction_status: 'capture', fraud_status: 'other' });

    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/midtrans/status/ORDER-OTHER');
    expect(res.status).toBe(200);
    expect(res.body.payment_status).toBe('pending');
  });

  test('GET /api/midtrans/status/:orderId unknown status keeps original status', async () => {
    const connection = buildConnection();
    connection.query
      .mockResolvedValueOnce([[{ id: 21, payment_status: 'pending' }], []])
      .mockResolvedValueOnce([{}, []]);

    midtransClient.Snap._status.mockResolvedValueOnce({ transaction_status: 'unknown', fraud_status: 'accept' });

    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/midtrans/status/ORDER-UNKNOWN');
    expect(res.status).toBe(200);
    expect(res.body.payment_status).toBe('pending');
  });

  test('GET /api/midtrans/status/:orderId settlement updates items when newly completed', async () => {
    const connection = buildConnection();
    connection.query
      .mockResolvedValueOnce([[{ id: 3, payment_status: 'pending' }], []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([[{ quantity: 1, product_id: 1 }], []])
      .mockResolvedValueOnce([{}, []]);

    midtransClient.Snap._status.mockResolvedValueOnce({ transaction_status: 'settlement', fraud_status: 'accept' });

    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/midtrans/status/ORDER-4');
    expect(res.status).toBe(200);
    expect(res.body.payment_status).toBe('completed');
  });

  test('GET /api/midtrans/status/:orderId deny -> failed', async () => {
    const connection = buildConnection();
    connection.query
      .mockResolvedValueOnce([[{ id: 4, payment_status: 'pending' }], []])
      .mockResolvedValueOnce([{}, []]);
    midtransClient.Snap._status.mockResolvedValueOnce({ transaction_status: 'deny', fraud_status: 'accept' });
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/midtrans/status/ORDER-DENY');
    expect(res.status).toBe(200);
    expect(res.body.payment_status).toBe('failed');
  });

  test('GET /api/midtrans/status/:orderId expire -> expired', async () => {
    const connection = buildConnection();
    connection.query
      .mockResolvedValueOnce([[{ id: 5, payment_status: 'pending' }], []])
      .mockResolvedValueOnce([{}, []]);
    midtransClient.Snap._status.mockResolvedValueOnce({ transaction_status: 'expire', fraud_status: 'accept' });
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/midtrans/status/ORDER-EXPIRE');
    expect(res.status).toBe(200);
    expect(res.body.payment_status).toBe('expired');
  });

  test('GET /api/midtrans/status/:orderId cancel -> canceled', async () => {
    const connection = buildConnection();
    connection.query
      .mockResolvedValueOnce([[{ id: 6, payment_status: 'pending' }], []])
      .mockResolvedValueOnce([{}, []]);
    midtransClient.Snap._status.mockResolvedValueOnce({ transaction_status: 'cancel', fraud_status: 'accept' });
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/midtrans/status/ORDER-CANCEL');
    expect(res.status).toBe(200);
    expect(res.body.payment_status).toBe('canceled');
  });

  test('GET /api/midtrans/status/:orderId completed transaction skips item updates', async () => {
    const connection = buildConnection();
    connection.query
      .mockResolvedValueOnce([[{ id: 7, payment_status: 'completed' }], []])
      .mockResolvedValueOnce([{}, []]);
    midtransClient.Snap._status.mockResolvedValueOnce({ transaction_status: 'settlement', fraud_status: 'accept' });
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/midtrans/status/ORDER-SKIP');
    expect(res.status).toBe(200);
    expect(res.body.payment_status).toBe('completed');
  });

  test('GET /api/midtrans/status/:orderId error triggers rollback returns 500', async () => {
    const connection = buildConnection();
    connection.query.mockRejectedValueOnce(new Error('db'));
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/midtrans/status/ORDER-ERR');
    expect(res.status).toBe(500);
  });

  test('POST /api/midtrans/callback transaction not found returns 404', async () => {
    const connection = buildConnection();
    connection.query.mockResolvedValueOnce([[], []]);
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/midtrans/callback').send({
      order_id: 'ORDER-404',
      transaction_status: 'settlement',
      fraud_status: 'accept',
    });
    expect(res.status).toBe(404);
  });

  test('POST /api/midtrans/callback settlement updates items', async () => {
    const connection = buildConnection();
    connection.query
      .mockResolvedValueOnce([[{ id: 10, payment_status: 'pending' }], []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([[{ quantity: 1, product_id: 1 }], []])
      .mockResolvedValueOnce([{}, []]);
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/midtrans/callback').send({
      order_id: 'ORDER-CB',
      transaction_status: 'settlement',
      fraud_status: 'accept',
    });
    expect(res.status).toBe(200);
  });

  test('POST /api/midtrans/callback capture challenge keeps pending', async () => {
    const connection = buildConnection();
    connection.query
      .mockResolvedValueOnce([[{ id: 11, payment_status: 'pending' }], []])
      .mockResolvedValueOnce([{}, []]);
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/midtrans/callback').send({
      order_id: 'ORDER-CB2',
      transaction_status: 'capture',
      fraud_status: 'challenge',
    });
    expect(res.status).toBe(200);
  });

  test('POST /api/midtrans/callback capture other fraud keeps original status', async () => {
    const connection = buildConnection();
    connection.query
      .mockResolvedValueOnce([[{ id: 15, payment_status: 'pending' }], []])
      .mockResolvedValueOnce([{}, []]);
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/midtrans/callback').send({
      order_id: 'ORDER-CB-OTHER',
      transaction_status: 'capture',
      fraud_status: 'other',
    });
    expect(res.status).toBe(200);
  });

  test('POST /api/midtrans/callback capture accept completes', async () => {
    const connection = buildConnection();
    connection.query
      .mockResolvedValueOnce([[{ id: 12, payment_status: 'pending' }], []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([[], []]);
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/midtrans/callback').send({
      order_id: 'ORDER-CB3',
      transaction_status: 'capture',
      fraud_status: 'accept',
    });
    expect(res.status).toBe(200);
  });

  test('POST /api/midtrans/callback cancel returns 200', async () => {
    const connection = buildConnection();
    connection.query
      .mockResolvedValueOnce([[{ id: 14, payment_status: 'pending' }], []])
      .mockResolvedValueOnce([{}, []]);
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/midtrans/callback').send({
      order_id: 'ORDER-CANCEL-CB',
      transaction_status: 'cancel',
      fraud_status: 'accept',
    });
    expect(res.status).toBe(200);
  });

  test('POST /api/midtrans/callback unknown status keeps original status', async () => {
    const connection = buildConnection();
    connection.query
      .mockResolvedValueOnce([[{ id: 16, payment_status: 'pending' }], []])
      .mockResolvedValueOnce([{}, []]);
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/midtrans/callback').send({
      order_id: 'ORDER-CB-UNKNOWN',
      transaction_status: 'unknown',
      fraud_status: 'accept',
    });
    expect(res.status).toBe(200);
  });

  test('POST /api/midtrans/callback deny/expire/cancel map statuses', async () => {
    const statuses = [
      { ts: 'deny', expected: 'failed' },
      { ts: 'expire', expected: 'expired' },
      { ts: 'cancel', expected: 'canceled' },
    ];

    for (const sc of statuses) {
      const connection = buildConnection();
      connection.query
        .mockResolvedValueOnce([[{ id: 13, payment_status: 'pending' }], []])
        .mockResolvedValueOnce([{}, []]);
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const app = buildApp({ pool });

      const res = await request(app).post('/api/midtrans/callback').send({
        order_id: `ORDER-${sc.ts}`,
        transaction_status: sc.ts,
        fraud_status: 'accept',
      });
      expect(res.status).toBe(200);
    }
  });

  test('POST /api/midtrans/callback error triggers rollback returns 500', async () => {
    const connection = buildConnection();
    connection.query.mockRejectedValueOnce(new Error('db'));
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/midtrans/callback').send({
      order_id: 'ORDER-ERR',
      transaction_status: 'settlement',
      fraud_status: 'accept',
    });
    expect(res.status).toBe(500);
  });

  test('GET /api/dashboard returns dashboard payload', async () => {
    const connection = buildConnection();
    connection.query
      .mockResolvedValueOnce([[{ name: 'P', count: 1 }], []])
      .mockResolvedValueOnce([[{ name: 'Week 01', value: 1000 }], []])
      .mockResolvedValueOnce([[{ id: 1, username: 'c', description: 'Cashier' }], []]);
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.stockRecommendations)).toBe(true);
  });

  test('GET /api/dashboard error returns 500', async () => {
    const pool = { getConnection: jest.fn().mockRejectedValueOnce(new Error('db')) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(500);
  });
});
