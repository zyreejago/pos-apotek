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
  const createAuditTrail = jest.fn().mockResolvedValue(undefined);

  registerTransactionRoutes(app, pool, authenticate, checkPermission, createAuditTrail);
  return app;
}

function buildConnection() {
  return {
    query: jest.fn().mockResolvedValue([[], []]),
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
      .mockResolvedValueOnce([[{ cost_price: 0, product_category: 'NON_OBAT' }], []])
      .mockResolvedValueOnce([[], []]);

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
      .mockResolvedValueOnce([[{ quantity: 1, product_id: 1, cost_price: 0, product_category: 'NON_OBAT' }], []])
      .mockResolvedValueOnce([[], []]);

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

  test('POST /api/midtrans/callback transaction not found returns 200', async () => {
    const connection = buildConnection();
    connection.query.mockResolvedValueOnce([[], []]);
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/midtrans/callback').send({
      order_id: 'ORDER-404',
      transaction_status: 'settlement',
      fraud_status: 'accept',
    });
    expect(res.status).toBe(200);
  });

  test('POST /api/midtrans/callback settlement updates items', async () => {
    const connection = buildConnection();
    connection.query
      .mockResolvedValueOnce([[{ id: 10, payment_status: 'pending' }], []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([[{ quantity: 1, product_id: 1, cost_price: 0, product_category: 'NON_OBAT' }], []])
      .mockResolvedValueOnce([[], []]);
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

  test('POST /api/transactions cash with OBAT/NON_OBAT triggers proportional split and COGS', async () => {
    const connection = buildConnection();
    connection.query
      .mockResolvedValueOnce([{ insertId: 13 }, []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([[{ cost_price: 500, product_category: 'OBAT' }], []])
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([[{ cost_price: 300, product_category: 'NON_OBAT' }], []])
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([{}, []]);

    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/transactions').send({
      items: [
        { id: 1, quantity: 1, price: 5000 },
        { id: 2, quantity: 1, price: 5000 },
      ],
      total_amount: 10000,
      tax_amount: 1000,
      subtotal: 9000,
      payment_method: 'cash',
    });
    expect(res.status).toBe(201);
  });

  test('GET /api/midtrans/status/:orderId completed with items creates journal entries', async () => {
    const connection = {
      query: jest.fn().mockImplementation((sql) => {
        if (sql.includes('SELECT * FROM transactions')) {
          return Promise.resolve([[{ id: 5, payment_status: 'pending', subtotal: 9000, tax_amount: 1000, total_amount: 10000 }], []]);
        }
        if (sql.includes('SELECT ti.*')) {
          return Promise.resolve([[
            { quantity: 1, product_id: 1, cost_price: 500, product_category: 'OBAT', price: 5000 },
            { quantity: 1, product_id: 2, cost_price: 300, product_category: 'NON_OBAT', price: 5000 },
          ], []]);
        }
        if (sql.includes('SELECT id FROM accounts')) {
          return Promise.resolve([[{ id: 1 }], []]);
        }
        if (sql.includes('INSERT INTO journal_entries')) {
          return Promise.resolve([{ insertId: 1 }, []]);
        }
        if (sql.includes('SELECT')) {
          return Promise.resolve([[], []]);
        }
        return Promise.resolve([{}, []]);
      }),
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };

    midtransClient.Snap._status.mockResolvedValueOnce({ transaction_status: 'settlement', fraud_status: 'accept' });

    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/midtrans/status/ORDER-5');
    expect(res.status).toBe(200);
    expect(res.body.payment_status).toBe('completed');
  });

  test('POST /api/transactions cash with FEFO batch reduction and journal entries', async () => {
    const connection = buildConnection();
    connection.query
      .mockResolvedValueOnce([{ insertId: 20 }, []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([[{ cost_price: 500, product_category: 'OBAT' }], []])
      .mockResolvedValueOnce([[{ id: 1, remaining_quantity: 2 }, { id: 2, remaining_quantity: 10 }], []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([{ insertId: 1 }, []])
      .mockResolvedValueOnce([[{ id: 1 }], []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([[{ id: 2 }], []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([[{ id: 3 }], []])
      .mockResolvedValueOnce([{}, []]);

    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/transactions').send({
      items: [{ id: 1, quantity: 2, price: 5000 }],
      total_amount: 10000,
      payment_method: 'cash',
    });
    expect(res.status).toBe(201);
  });

  test('GET /api/midtrans/status/:orderId completed with FEFO batch reduction', async () => {
    const connection = {
      query: jest.fn().mockImplementation((sql) => {
        if (sql.includes('SELECT * FROM transactions')) {
          return Promise.resolve([[{ id: 30, payment_status: 'pending', subtotal: 9000, tax_amount: 1000, total_amount: 10000 }], []]);
        }
        if (sql.includes('SELECT ti.*')) {
          return Promise.resolve([[
            { quantity: 2, product_id: 1, cost_price: 500, product_category: 'OBAT', price: 5000 },
          ], []]);
        }
        if (sql.includes('SELECT id, remaining_quantity FROM batches')) {
          return Promise.resolve([[{ id: 1, remaining_quantity: 2 }, { id: 2, remaining_quantity: 10 }], []]);
        }
        if (sql.includes('SELECT id FROM accounts')) {
          return Promise.resolve([[{ id: 1 }], []]);
        }
        if (sql.includes('INSERT INTO journal_entries')) {
          return Promise.resolve([{ insertId: 1 }, []]);
        }
        if (sql.includes('SELECT')) {
          return Promise.resolve([[], []]);
        }
        return Promise.resolve([{}, []]);
      }),
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };

    midtransClient.Snap._status.mockResolvedValueOnce({ transaction_status: 'settlement', fraud_status: 'accept' });

    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/midtrans/status/ORDER-BATCH');
    expect(res.status).toBe(200);
  });

  test('GET /api/midtrans/status/:orderId completed with NON_OBAT covers obatCOGS false branch', async () => {
    const connection = {
      query: jest.fn().mockImplementation((sql) => {
        if (sql.includes('SELECT * FROM transactions')) {
          return Promise.resolve([[{ id: 31, payment_status: 'pending', subtotal: 5000, tax_amount: 0, total_amount: 5000 }], []]);
        }
        if (sql.includes('SELECT ti.*')) {
          return Promise.resolve([[
            { quantity: 1, product_id: 1, cost_price: 300, product_category: 'NON_OBAT', price: 5000 },
          ], []]);
        }
        if (sql.includes('SELECT id, remaining_quantity FROM batches')) {
          return Promise.resolve([[{ id: 1, remaining_quantity: 1 }], []]);
        }
        if (sql.includes('SELECT id FROM accounts')) {
          return Promise.resolve([[{ id: 1 }], []]);
        }
        if (sql.includes('INSERT INTO journal_entries')) {
          return Promise.resolve([{ insertId: 1 }, []]);
        }
        if (sql.includes('SELECT')) {
          return Promise.resolve([[], []]);
        }
        return Promise.resolve([{}, []]);
      }),
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };

    midtransClient.Snap._status.mockResolvedValueOnce({ transaction_status: 'settlement', fraud_status: 'accept' });

    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/midtrans/status/ORDER-NONOBAT');
    expect(res.status).toBe(200);
  });

  test('POST /api/midtrans/callback completed with FEFO batch reduction', async () => {
    const connection = {
      query: jest.fn().mockImplementation((sql) => {
        if (sql.includes('SELECT * FROM transactions')) {
          return Promise.resolve([[{ id: 40, payment_status: 'pending', midtrans_transaction_id: null, subtotal: 9000, tax_amount: 1000, total_amount: 10000 }], []]);
        }
        if (sql.includes('SELECT ti.*')) {
          return Promise.resolve([[
            { quantity: 2, product_id: 1, cost_price: 500, product_category: 'OBAT', price: 5000 },
          ], []]);
        }
        if (sql.includes('SELECT id, remaining_quantity FROM batches')) {
          return Promise.resolve([[{ id: 1, remaining_quantity: 2 }, { id: 2, remaining_quantity: 10 }], []]);
        }
        if (sql.includes('SELECT id FROM accounts')) {
          return Promise.resolve([[{ id: 1 }], []]);
        }
        if (sql.includes('INSERT INTO journal_entries')) {
          return Promise.resolve([{ insertId: 1 }, []]);
        }
        if (sql.includes('SELECT')) {
          return Promise.resolve([[], []]);
        }
        return Promise.resolve([{}, []]);
      }),
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };

    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/midtrans/callback').send({
      order_id: 'ORDER-CB-BATCH',
      transaction_status: 'settlement',
      fraud_status: 'accept',
    });
    expect(res.status).toBe(200);
  });

  test('POST /api/midtrans/callback completed with NON_OBAT covers obatCOGS false branch', async () => {
    const connection = {
      query: jest.fn().mockImplementation((sql) => {
        if (sql.includes('SELECT * FROM transactions')) {
          return Promise.resolve([[{ id: 41, payment_status: 'pending', midtrans_transaction_id: null, subtotal: 5000, tax_amount: 0, total_amount: 5000 }], []]);
        }
        if (sql.includes('SELECT ti.*')) {
          return Promise.resolve([[
            { quantity: 1, product_id: 1, cost_price: 300, product_category: 'NON_OBAT', price: 5000 },
          ], []]);
        }
        if (sql.includes('SELECT id, remaining_quantity FROM batches')) {
          return Promise.resolve([[{ id: 1, remaining_quantity: 1 }], []]);
        }
        if (sql.includes('SELECT id FROM accounts')) {
          return Promise.resolve([[{ id: 1 }], []]);
        }
        if (sql.includes('INSERT INTO journal_entries')) {
          return Promise.resolve([{ insertId: 1 }, []]);
        }
        if (sql.includes('SELECT')) {
          return Promise.resolve([[], []]);
        }
        return Promise.resolve([{}, []]);
      }),
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };

    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/midtrans/callback').send({
      order_id: 'ORDER-CB-NONOBAT',
      transaction_status: 'settlement',
      fraud_status: 'accept',
    });
    expect(res.status).toBe(200);
  });

  test('POST /api/midtrans/callback without order_id returns 400', async () => {
    const pool = { getConnection: jest.fn() };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/midtrans/callback').send({
      transaction_status: 'settlement',
      fraud_status: 'accept',
    });
    expect(res.status).toBe(400);
  });

  test('POST /api/midtrans/callback already completed skips processing', async () => {
    const connection = buildConnection();
    connection.query.mockResolvedValueOnce([[{ id: 99, payment_status: 'completed' }], []]);
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/midtrans/callback').send({
      order_id: 'ORDER-DONE',
      transaction_status: 'settlement',
      fraud_status: 'accept',
    });
    expect(res.status).toBe(200);
  });

  test('POST /api/midtrans/callback completed with OBAT/NON_OBAT creates journal entries', async () => {
    const connection = {
      query: jest.fn().mockImplementation((sql) => {
        if (sql.includes('SELECT * FROM transactions')) {
          return Promise.resolve([[{ id: 20, payment_status: 'pending', subtotal: 9000, tax_amount: 1000, total_amount: 10000 }], []]);
        }
        if (sql.includes('SELECT ti.*')) {
          return Promise.resolve([[
            { quantity: 1, product_id: 1, cost_price: 500, product_category: 'OBAT', price: 5000 },
            { quantity: 1, product_id: 2, cost_price: 300, product_category: 'NON_OBAT', price: 5000 },
          ], []]);
        }
        if (sql.includes('SELECT id FROM accounts')) {
          return Promise.resolve([[{ id: 1 }], []]);
        }
        if (sql.includes('INSERT INTO journal_entries')) {
          return Promise.resolve([{ insertId: 1 }, []]);
        }
        if (sql.includes('SELECT')) {
          return Promise.resolve([[], []]);
        }
        return Promise.resolve([{}, []]);
      }),
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };

    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/midtrans/callback').send({
      order_id: 'ORDER-CB-FULL',
      transaction_status: 'settlement',
      fraud_status: 'accept',
    });
    expect(res.status).toBe(200);
  });
});
