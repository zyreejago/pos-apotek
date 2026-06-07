const express = require('express');
const request = require('supertest');

const registerProductRoutes = require('../routes/products');

function buildApp({ pool, user }) {
  const app = express();
  app.use(express.json());

  const authenticate = (req, _res, next) => {
    req.user = user || { id: 1, role: 'superadmin' };
    next();
  };
  const checkPermission = () => (_req, _res, next) => next();
  const createAuditTrail = jest.fn().mockResolvedValue(undefined);

  registerProductRoutes(app, pool, authenticate, checkPermission, createAuditTrail);
  return app;
}

describe('products module', () => {
  test('GET /api/products without search returns paginated list', async () => {
    const connection = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[{ id: 1, name: 'P' }], []])
        .mockResolvedValueOnce([[{ total: 1 }], []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/products?page=1&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(1);
  });

  test('GET /api/products with search returns paginated list', async () => {
    const connection = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[{ id: 1, name: 'P' }], []])
        .mockResolvedValueOnce([[{ total: 1 }], []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/products?page=1&limit=10&search=Par');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /api/products error returns 500', async () => {
    const pool = { getConnection: jest.fn().mockRejectedValueOnce(new Error('db')) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/products');
    expect(res.status).toBe(500);
  });

  test('POST /api/products validation returns 400', async () => {
    const pool = { getConnection: jest.fn() };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/products').send({ cost_price: 1000 });
    expect(res.status).toBe(400);
  });

  test('POST /api/products success returns 201', async () => {
    const connection = {
      query: jest.fn().mockResolvedValueOnce([{ insertId: 10 }, []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/products').send({
      name: 'P',
      cost_price: 1000,
      selling_price: 2000,
      stock: 5,
      category: 'General',
      unit: 'pcs',
      expired_date: null,
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(10);
  });

  test('POST /api/products error returns 500', async () => {
    const connection = { query: jest.fn().mockRejectedValueOnce(new Error('db')), release: jest.fn() };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/products').send({ name: 'P', cost_price: 1000 });
    expect(res.status).toBe(500);
  });

  test('PUT /api/products/:id success returns 200', async () => {
    const connection = { query: jest.fn().mockResolvedValueOnce([{}, []]), release: jest.fn() };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).put('/api/products/1').send({
      name: 'P',
      cost_price: 1000,
      selling_price: 2000,
      stock: 5,
      category: 'General',
      unit: 'pcs',
      expired_date: null,
    });
    expect(res.status).toBe(200);
  });

  test('PUT /api/products/:id error returns 500', async () => {
    const connection = { query: jest.fn().mockRejectedValueOnce(new Error('db')), release: jest.fn() };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).put('/api/products/1').send({ name: 'P' });
    expect(res.status).toBe(500);
  });

  test('DELETE /api/products/:id not found returns 404', async () => {
    const connection = {
      query: jest.fn().mockResolvedValueOnce([[], []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).delete('/api/products/99');
    expect(res.status).toBe(404);
  });

  test('DELETE /api/products/:id success returns 200', async () => {
    const connection = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[{ id: 1 }], []])
        .mockResolvedValueOnce([{}, []])
        .mockResolvedValueOnce([{}, []])
        .mockResolvedValueOnce([[{ maxId: 10 }], []])
        .mockResolvedValueOnce([{}, []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).delete('/api/products/1');
    expect(res.status).toBe(200);
  });

  test('DELETE /api/products/:id handles null maxId', async () => {
    const connection = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[{ id: 1 }], []])
        .mockResolvedValueOnce([{}, []])
        .mockResolvedValueOnce([{}, []])
        .mockResolvedValueOnce([[{ maxId: null }], []])
        .mockResolvedValueOnce([{}, []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).delete('/api/products/1');
    expect(res.status).toBe(200);
  });

  test('DELETE /api/products/:id error returns 500', async () => {
    const connection = { query: jest.fn().mockRejectedValueOnce(new Error('db')), release: jest.fn() };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).delete('/api/products/1');
    expect(res.status).toBe(500);
  });

  test('POST /api/inventory/adjust missing fields returns 400', async () => {
    const pool = { getConnection: jest.fn() };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/inventory/adjust').send({ productId: 1 });
    expect(res.status).toBe(400);
  });

  test('POST /api/inventory/adjust product not found returns 404', async () => {
    const connection = {
      query: jest.fn().mockResolvedValueOnce([[], []]),
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/inventory/adjust').send({ productId: 1, type: 'add', quantity: 1 });
    expect(res.status).toBe(404);
  });

  test('POST /api/inventory/adjust add success returns 200', async () => {
    const connection = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[{ stock: 10 }], []])
        .mockResolvedValueOnce([{}, []])
        .mockResolvedValueOnce([{}, []]),
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/inventory/adjust').send({ productId: 1, type: 'add', quantity: 2, note: 'n' });
    expect(res.status).toBe(200);
    expect(res.body.newStock).toBe(12);
  });

  test('POST /api/inventory/adjust reduce insufficient stock returns 400', async () => {
    const connection = {
      query: jest.fn().mockResolvedValueOnce([[{ stock: 1 }], []]),
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/inventory/adjust').send({ productId: 1, type: 'reduce', quantity: 2 });
    expect(res.status).toBe(400);
  });

  test('POST /api/inventory/adjust reduce success returns 200', async () => {
    const connection = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[{ stock: 10 }], []])
        .mockResolvedValueOnce([{}, []])
        .mockResolvedValueOnce([{}, []]),
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/inventory/adjust').send({ productId: 1, type: 'reduce', quantity: 2 });
    expect(res.status).toBe(200);
    expect(res.body.newStock).toBe(8);
  });

  test('POST /api/inventory/adjust invalid type returns 400', async () => {
    const connection = {
      query: jest.fn().mockResolvedValueOnce([[{ stock: 10 }], []]),
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/inventory/adjust').send({ productId: 1, type: 'x', quantity: 2 });
    expect(res.status).toBe(400);
  });

  test('POST /api/inventory/adjust error triggers rollback returns 500', async () => {
    const connection = {
      query: jest.fn().mockRejectedValueOnce(new Error('db')),
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn(),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/inventory/adjust').send({ productId: 1, type: 'add', quantity: 2 });
    expect(res.status).toBe(500);
  });

  test('POST /api/stock-opname invalid items returns 400', async () => {
    const pool = { getConnection: jest.fn() };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/stock-opname').send({ items: 'no' });
    expect(res.status).toBe(400);
  });

  test('POST /api/stock-opname success handles difference 0 and non-0', async () => {
    const connection = {
      query: jest.fn().mockResolvedValue([{}, []]),
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/stock-opname').send({
      items: [
        { id: 1, system_stock: 10, actual_stock: 10 },
        { id: 2, system_stock: 10, actual_stock: 8 },
      ],
      note: 'op',
    });
    expect(res.status).toBe(200);
  });

  test('POST /api/stock-opname uses default note when missing', async () => {
    const connection = {
      query: jest.fn().mockResolvedValue([{}, []]),
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/stock-opname').send({
      items: [{ id: 2, system_stock: 10, actual_stock: 8 }],
    });
    expect(res.status).toBe(200);
  });

  test('POST /api/stock-opname with OBAT product uses persediaan code 103', async () => {
    const connection = {
      query: jest.fn()
        .mockResolvedValue([{}, []])
        .mockResolvedValueOnce([{}, []])
        .mockResolvedValueOnce([[{ cost_price: 1000, product_category: 'OBAT', name: 'Test' }], []]),
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/stock-opname').send({
      items: [{ id: 1, system_stock: 10, actual_stock: 8 }],
      note: 'test',
    });
    expect(res.status).toBe(200);
  });

  test('POST /api/stock-opname error triggers rollback returns 500', async () => {
    const connection = {
      query: jest.fn().mockRejectedValueOnce(new Error('db')),
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn(),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/stock-opname').send({ items: [{ id: 1, system_stock: 10, actual_stock: 8 }] });
    expect(res.status).toBe(500);
  });

  test('POST /api/products with invalid expired_date returns 201', async () => {
    const connection = {
      query: jest.fn().mockResolvedValueOnce([{ insertId: 20 }, []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/products').send({
      name: 'P', cost_price: 1000, expired_date: 'not-a-date',
    });
    expect(res.status).toBe(201);
  });

  test('PUT /api/products/:id with invalid expired_date returns 200', async () => {
    const connection = { query: jest.fn().mockResolvedValueOnce([{}, []]), release: jest.fn() };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).put('/api/products/1').send({
      name: 'P', cost_price: 1000, expired_date: 'not-a-date',
    });
    expect(res.status).toBe(200);
  });

  test('POST /api/products with needsApproval returns 201', async () => {
    const connection = {
      query: jest.fn().mockResolvedValueOnce([{ insertId: 40 }, []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/products').send({
      name: 'P', cost_price: 1000, needsApproval: true,
    });
    expect(res.status).toBe(201);
  });

  test('POST /api/products with valid expired_date formats date', async () => {
    const connection = {
      query: jest.fn().mockResolvedValueOnce([{ insertId: 30 }, []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/products').send({
      name: 'P', cost_price: 1000, expired_date: '2025-12-31',
    });
    expect(res.status).toBe(201);
  });

  test('PUT /api/products/:id with valid expired_date formats date', async () => {
    const connection = { query: jest.fn().mockResolvedValueOnce([{}, []]), release: jest.fn() };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).put('/api/products/1').send({
      name: 'P', cost_price: 1000, expired_date: '2025-12-31',
    });
    expect(res.status).toBe(200);
  });

  test('POST /api/stock-opname with stock increase triggers positive difference branch', async () => {
    const connection = {
      query: jest.fn().mockResolvedValue([{}, []]),
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).post('/api/stock-opname').send({
      items: [{ id: 1, system_stock: 10, actual_stock: 15 }],
      note: 'increase',
    });
    expect(res.status).toBe(200);
  });

  test('GET /api/products returns server error on db failure', async () => {
    const pool = { getConnection: jest.fn().mockRejectedValue(new Error('db')) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/products?page=1&limit=10');
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Server error');
  });
});
