const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

async function loadAppWithMockedDb() {
  process.env.JWT_SECRET = 'test_jwt_secret';

  jest.resetModules();

  jest.doMock('midtrans-client', () => {
    class Snap {
      constructor() {
        this.transaction = {
          status: jest.fn().mockResolvedValue({
            transaction_status: 'settlement',
            fraud_status: 'accept',
          }),
        };
      }
      createTransaction() {
        return Promise.resolve({ redirect_url: 'https://example.com/redirect' });
      }
    }
    return { Snap };
  });

  const mockConnection = {
    query: jest.fn().mockResolvedValue([[], []]),
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    release: jest.fn(),
  };

  const mockPool = {
    query: jest.fn().mockResolvedValue([[]]),
    getConnection: jest.fn().mockResolvedValue(mockConnection),
  };

  jest.doMock('../db', () => ({
    pool: mockPool,
    initDB: jest.fn().mockResolvedValue(undefined),
  }));

  const { app } = require('../index');

  const superadminToken = jwt.sign(
    { id: 1, username: 'admin', role: 'superadmin', email: 'admin@example.com' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  return { app, mockPool, mockConnection, superadminToken };
}

describe('feature integration (backend)', () => {
  test('GET /api/profile returns profile', async () => {
    const { app, mockPool, superadminToken } = await loadAppWithMockedDb();

    mockPool.query.mockResolvedValueOnce([
      [{ id: 1, username: 'admin', email: 'admin@example.com', role: 'superadmin' }],
      [],
    ]);

    const res = await request(app)
      .get('/api/profile')
      .set('Authorization', `Bearer ${superadminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('admin@example.com');
  });

  test('GET /api/settings returns settings map', async () => {
    const { app, mockConnection, superadminToken } = await loadAppWithMockedDb();

    mockConnection.query.mockResolvedValueOnce([
      [
        { setting_key: 'ppn_rate', setting_value: '0.11' },
        { setting_key: 'discount_rate', setting_value: '0.05' },
      ],
      [],
    ]);

    const res = await request(app)
      .get('/api/settings')
      .set('Authorization', `Bearer ${superadminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.ppn_rate).toBe('0.11');
    expect(res.body.discount_rate).toBe('0.05');
  });

  test('PUT /api/settings updates settings', async () => {
    const { app, mockConnection, superadminToken } = await loadAppWithMockedDb();

    mockConnection.query.mockResolvedValueOnce([{}, []]);
    mockConnection.query.mockResolvedValueOnce([{}, []]);

    const res = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ ppn_rate: 0.11, discount_rate: 0.05 });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('updated');
  });

  test('GET /api/users returns paginated list', async () => {
    const { app, mockConnection, superadminToken } = await loadAppWithMockedDb();

    mockConnection.query
      .mockResolvedValueOnce([
        [{ id: 1, username: 'u', email: 'u@u.com', role: 'user', status: 'active' }],
        [],
      ])
      .mockResolvedValueOnce([[{ total: 1 }], []]);

    const res = await request(app)
      .get('/api/users?page=1&limit=10')
      .set('Authorization', `Bearer ${superadminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination.total).toBe(1);
  });

  test('GET /api/products returns paginated list', async () => {
    const { app, mockConnection, superadminToken } = await loadAppWithMockedDb();

    mockConnection.query
      .mockResolvedValueOnce([[{ id: 1, name: 'Paracetamol' }], []])
      .mockResolvedValueOnce([[{ total: 1 }], []]);

    const res = await request(app)
      .get('/api/products?page=1&limit=10')
      .set('Authorization', `Bearer ${superadminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination.total).toBe(1);
  });

  test('POST /api/products validation', async () => {
    const { app, superadminToken } = await loadAppWithMockedDb();

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ cost_price: 1000 });

    expect(res.status).toBe(400);
  });

  test('POST /api/products creates product', async () => {
    const { app, mockConnection, superadminToken } = await loadAppWithMockedDb();

    mockConnection.query.mockResolvedValueOnce([{ insertId: 10 }, []]);

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ name: 'Amoxicillin', cost_price: 1000, selling_price: 1500, stock: 5 });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(10);
  });

  test('POST /api/inventory/adjust missing fields returns 400', async () => {
    const { app, superadminToken } = await loadAppWithMockedDb();

    const res = await request(app)
      .post('/api/inventory/adjust')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ productId: 1 });

    expect(res.status).toBe(400);
  });

  test('GET /api/suppliers returns paginated list', async () => {
    const { app, mockConnection, superadminToken } = await loadAppWithMockedDb();

    mockConnection.query
      .mockResolvedValueOnce([[{ id: 1, name: 'PT Supplier' }], []])
      .mockResolvedValueOnce([[{ total: 1 }], []]);

    const res = await request(app)
      .get('/api/suppliers?page=1&limit=10')
      .set('Authorization', `Bearer ${superadminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('POST /api/transactions missing items returns 400', async () => {
    const { app, superadminToken } = await loadAppWithMockedDb();

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ items: [] });

    expect(res.status).toBe(400);
  });

  test('POST /api/transactions cash flow returns 201', async () => {
    const { app, mockConnection, superadminToken } = await loadAppWithMockedDb();

    mockConnection.query
      .mockResolvedValueOnce([{ insertId: 123 }, []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([[{ cost_price: 500, product_category: 'OBAT' }], []])
      .mockResolvedValueOnce([[{ id: 1, remaining_quantity: 10 }], []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([{}, []]);

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({
        payment_method: 'cash',
        total_amount: 10000,
        items: [{ id: 1, quantity: 2, price: 5000 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(123);
  });

  test('GET /api/financial/profit-loss missing params returns 400', async () => {
    const { app, superadminToken } = await loadAppWithMockedDb();

    const res = await request(app)
      .get('/api/financial/profit-loss')
      .set('Authorization', `Bearer ${superadminToken}`);

    expect(res.status).toBe(400);
  });

  test('GET /api/forecast/latest returns list', async () => {
    const { app, mockPool, superadminToken } = await loadAppWithMockedDb();

    mockPool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([
        [{ id: 1, name: 'Paracetamol', stock: 10, unit: 'pcs', tambahan_stok: 5 }],
        [],
      ]);

    const res = await request(app)
      .get('/api/forecast/latest')
      .set('Authorization', `Bearer ${superadminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/forecast-openrouter/products returns list', async () => {
    const { app, mockPool, superadminToken } = await loadAppWithMockedDb();

    mockPool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([
        [{ id: 1, name: 'Paracetamol', stock: 10, unit: 'pcs' }],
        [],
      ]);

    const res = await request(app)
      .get('/api/forecast-openrouter/products')
      .set('Authorization', `Bearer ${superadminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/auth/verify-reset-code invalid email returns 400', async () => {
    const { app } = await loadAppWithMockedDb();
    const res = await request(app).post('/api/auth/verify-reset-code').send({
      email: 'not-an-email',
      code: '123456',
    });
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/reset-password short password returns 400', async () => {
    const { app } = await loadAppWithMockedDb();
    const res = await request(app).post('/api/auth/reset-password').send({
      email: 'a@a.com',
      resetToken: 't',
      newPassword: '123',
    });
    expect(res.status).toBe(400);
  });

  test('PUT /api/profile missing fields returns 400', async () => {
    const { app, superadminToken } = await loadAppWithMockedDb();
    const res = await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ username: 'u' });
    expect(res.status).toBe(400);
  });

  test('PUT /api/profile existing username/email returns 409', async () => {
    const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
    mockPool.query.mockResolvedValueOnce([[{ id: 2 }], []]);

    const res = await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ username: 'admin', email: 'admin@example.com' });
    expect(res.status).toBe(409);
  });

  test('PUT /api/profile updates profile returns 200', async () => {
    const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
    mockPool.query.mockResolvedValueOnce([[], []]);
    mockPool.query.mockResolvedValueOnce([{}, []]);

    const res = await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ username: 'admin2', email: 'admin2@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('admin2@example.com');
  });

  test('PUT /api/profile/password wrong old password returns 400', async () => {
    const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
    const hash = await bcrypt.hash('correct_old', 10);
    mockPool.query.mockResolvedValueOnce([[{ password: hash }], []]);

    const res = await request(app)
      .put('/api/profile/password')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ oldPassword: 'wrong_old', newPassword: 'new_password' });
    expect(res.status).toBe(400);
  });

  test('PUT /api/profile/password updates password returns 200', async () => {
    const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
    const hash = await bcrypt.hash('old_password', 10);
    mockPool.query.mockResolvedValueOnce([[{ password: hash }], []]);
    mockPool.query.mockResolvedValueOnce([{}, []]);

    const res = await request(app)
      .put('/api/profile/password')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ oldPassword: 'old_password', newPassword: 'new_password' });
    expect(res.status).toBe(200);
  });

  test('POST /api/users validation returns 400', async () => {
    const { app, superadminToken } = await loadAppWithMockedDb();
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ username: 'u' });
    expect(res.status).toBe(400);
  });

  test('POST /api/users creates user returns 201', async () => {
    const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
    mockPool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 9 }, []]);
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ username: 'u', email: 'u@u.com', password: '123456', role: 'user', status: 'active' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(9);
  });

  test('PUT /api/users/:id not found returns 404', async () => {
    const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
    mockPool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[], []]);
    const res = await request(app)
      .put('/api/users/99')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ username: 'x', email: 'x@x.com', role: 'user', status: 'active' });
    expect(res.status).toBe(404);
  });

  test('PUT /api/users/:id updates user returns 200', async () => {
    const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
    mockPool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id: 1, role: 'user' }], []])
      .mockResolvedValueOnce([{}, []]);
    const res = await request(app)
      .put('/api/users/1')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ username: 'u2', email: 'u2@u.com', role: 'user', status: 'active' });
    expect(res.status).toBe(200);
  });

  test('DELETE /api/users/:id cannot delete self returns 403', async () => {
    const { app, superadminToken } = await loadAppWithMockedDb();
    const res = await request(app)
      .delete('/api/users/1')
      .set('Authorization', `Bearer ${superadminToken}`);
    expect(res.status).toBe(403);
  });

  test('DELETE /api/users/:id deletes user returns 200', async () => {
    const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
    mockPool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ role: 'user' }], []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    const res = await request(app)
      .delete('/api/users/2')
      .set('Authorization', `Bearer ${superadminToken}`);
    expect(res.status).toBe(200);
  });

  test('POST /api/suppliers validation returns 400', async () => {
    const { app, superadminToken } = await loadAppWithMockedDb();
    const res = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ phone: '1' });
    expect(res.status).toBe(400);
  });

  test('POST /api/suppliers creates supplier returns 201', async () => {
    const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
    mockPool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 5 }, []]);
    const res = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ name: 'PT A', contact_person: 'B', phone: '1', address: 'X' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(5);
  });

  test('PUT /api/suppliers/:id updates supplier returns 200', async () => {
    const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
    mockPool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{}, []]);
    const res = await request(app)
      .put('/api/suppliers/1')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ name: 'PT B', contact_person: 'C', phone: '2', address: 'Y' });
    expect(res.status).toBe(200);
  });

  test('DELETE /api/suppliers/:id deletes supplier returns 200', async () => {
    const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
    mockPool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{}, []]);
    const res = await request(app)
      .delete('/api/suppliers/1')
      .set('Authorization', `Bearer ${superadminToken}`);
    expect(res.status).toBe(200);
  });

  test('PUT /api/products/:id updates product returns 200', async () => {
    const { app, mockConnection, superadminToken } = await loadAppWithMockedDb();
    mockConnection.query.mockResolvedValueOnce([{}, []]);
    const res = await request(app)
      .put('/api/products/1')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ name: 'P', cost_price: 1000, selling_price: 1500, stock: 1, category: 'General', unit: 'pcs', expired_date: null });
    expect(res.status).toBe(200);
  });

  test('DELETE /api/products/:id product not found returns 404', async () => {
    const { app, mockConnection, superadminToken } = await loadAppWithMockedDb();
    mockConnection.query.mockResolvedValueOnce([[], []]);
    const res = await request(app)
      .delete('/api/products/99')
      .set('Authorization', `Bearer ${superadminToken}`);
    expect(res.status).toBe(404);
  });

  test('DELETE /api/products/:id deletes product returns 200', async () => {
    const { app, mockConnection, superadminToken } = await loadAppWithMockedDb();
    mockConnection.query
      .mockResolvedValueOnce([[{ id: 1 }], []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([[{ maxId: 10 }], []])
      .mockResolvedValueOnce([{}, []]);

    const res = await request(app)
      .delete('/api/products/1')
      .set('Authorization', `Bearer ${superadminToken}`);
    expect(res.status).toBe(200);
  });

  test('POST /api/inventory/adjust add flow returns 200', async () => {
    const { app, mockConnection, superadminToken } = await loadAppWithMockedDb();
    mockConnection.query
      .mockResolvedValueOnce([[{ stock: 10 }], []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([{}, []]);

    const res = await request(app)
      .post('/api/inventory/adjust')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ productId: 1, type: 'add', quantity: 2, note: 'test' });
    expect(res.status).toBe(200);
    expect(res.body.newStock).toBe(12);
  });

  test('POST /api/inventory/adjust reduce insufficient stock returns 400', async () => {
    const { app, mockConnection, superadminToken } = await loadAppWithMockedDb();
    mockConnection.query.mockResolvedValueOnce([[{ stock: 1 }], []]);
    const res = await request(app)
      .post('/api/inventory/adjust')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ productId: 1, type: 'reduce', quantity: 2, note: 'test' });
    expect(res.status).toBe(400);
  });

  test('POST /api/stock-opname invalid items returns 400', async () => {
    const { app, superadminToken } = await loadAppWithMockedDb();
    const res = await request(app)
      .post('/api/stock-opname')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ items: 'not-array' });
    expect(res.status).toBe(400);
  });

  test('POST /api/stock-opname success returns 200', async () => {
    const { app, mockConnection, superadminToken } = await loadAppWithMockedDb();
    mockConnection.query
      .mockResolvedValueOnce([{ insertId: 1 }, []])
      .mockResolvedValue([[{ id: 1 }], []]);

    const res = await request(app)
      .post('/api/stock-opname')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ items: [{ id: 1, system_stock: 10, actual_stock: 8 }], note: 'opname' });
    expect(res.status).toBe(200);
  });

  test('GET /api/reports/transactions missing params returns 400', async () => {
    const { app, superadminToken } = await loadAppWithMockedDb();
    const res = await request(app)
      .get('/api/reports/transactions')
      .set('Authorization', `Bearer ${superadminToken}`);
    expect(res.status).toBe(400);
  });

  test('GET /api/reports/transactions returns report', async () => {
    const { app, mockConnection, superadminToken } = await loadAppWithMockedDb();

    mockConnection.query
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
      ]);

    const res = await request(app)
      .get('/api/reports/transactions?startDate=2026-01-01&endDate=2026-01-31')
      .set('Authorization', `Bearer ${superadminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.transactions)).toBe(true);
    expect(Array.isArray(res.body.chartData)).toBe(true);
  });

  test('GET /api/reports/balance returns balance sheet', async () => {
    const { app, mockConnection, superadminToken } = await loadAppWithMockedDb();
    mockConnection.query
      .mockResolvedValueOnce([[{ total_cash: 1000 }], []])
      .mockResolvedValueOnce([[{ total_inventory: 500 }], []])
      .mockResolvedValueOnce([[{ total_revenue: 5000 }], []])
      .mockResolvedValueOnce([[{ total_cogs: 200 }], []]);

    const res = await request(app)
      .get('/api/reports/balance')
      .set('Authorization', `Bearer ${superadminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.assets.total).toBe(1500);
  });

  test('GET /api/dashboard returns dashboard payload', async () => {
    const { app, mockConnection, superadminToken } = await loadAppWithMockedDb();
    mockConnection.query
      .mockResolvedValueOnce([[{ name: 'P', count: 1 }], []])
      .mockResolvedValueOnce([[{ name: 'Week 01', value: 1000 }], []])
      .mockResolvedValueOnce([[{ id: 1, username: 'c', description: 'Cashier' }], []]);

    const res = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${superadminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.stockRecommendations)).toBe(true);
  });

  test('POST /api/transactions midtrans flow returns redirect_url', async () => {
    const { app, mockConnection, superadminToken } = await loadAppWithMockedDb();
    mockConnection.query
      .mockResolvedValueOnce([{ insertId: 321 }, []])
      .mockResolvedValueOnce([{}, []]);

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({
        payment_method: 'midtrans',
        total_amount: 10000,
        items: [{ id: 1, quantity: 2, price: 5000 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.redirect_url).toContain('https://');
  });

  test('GET /api/midtrans/status/:orderId not found returns 404', async () => {
    const { app, mockConnection, superadminToken } = await loadAppWithMockedDb();
    mockConnection.query.mockResolvedValueOnce([[], []]);
    const res = await request(app)
      .get('/api/midtrans/status/ORDER-1')
      .set('Authorization', `Bearer ${superadminToken}`);
    expect(res.status).toBe(404);
  });

  test('GET /api/midtrans/status/:orderId updates payment to completed returns 200', async () => {
    const { app, mockConnection, superadminToken } = await loadAppWithMockedDb();
    mockConnection.query
      .mockResolvedValueOnce([[{ id: 7, midtrans_order_id: 'ORDER-2', payment_status: 'pending', subtotal: null, tax_amount: null, total_amount: 10000 }], []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([[{ quantity: 2, product_id: 1, cost_price: 500, product_category: 'OBAT', price: 1000 }], []])
      .mockResolvedValueOnce([[{ id: 1, remaining_quantity: 10 }], []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([[{ id: 2 }], []]);

    const res = await request(app)
      .get('/api/midtrans/status/ORDER-2')
      .set('Authorization', `Bearer ${superadminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.payment_status).toBe('completed');
  });

  test('POST /api/midtrans/callback transaction not found returns 200', async () => {
    const { app, mockConnection } = await loadAppWithMockedDb();
    mockConnection.query.mockResolvedValueOnce([[], []]);
    const res = await request(app).post('/api/midtrans/callback').send({
      order_id: 'ORDER-404',
      transaction_status: 'settlement',
      fraud_status: 'accept',
    });
    expect(res.status).toBe(200);
  });

  test('POST /api/midtrans/callback success returns 200', async () => {
    const { app, mockConnection } = await loadAppWithMockedDb();
    mockConnection.query
      .mockResolvedValueOnce([[{ id: 9, payment_status: 'pending', subtotal: null, tax_amount: null, total_amount: 10000 }], []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([[{ quantity: 1, product_id: 1, cost_price: 500, product_category: 'OBAT' }], []])
      .mockResolvedValueOnce([[{ id: 1, remaining_quantity: 10 }], []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([[{ id: 2 }], []]);

    const res = await request(app).post('/api/midtrans/callback').send({
      order_id: 'ORDER-OK',
      transaction_status: 'settlement',
      fraud_status: 'accept',
    });
    expect(res.status).toBe(200);
  });

  test('POST /api/forecast/stock invalid product_id returns 400', async () => {
    const { app, superadminToken } = await loadAppWithMockedDb();
    const res = await request(app)
      .post('/api/forecast/stock')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ product_id: 0 });
    expect(res.status).toBe(400);
  });

  test('POST /api/forecast/stock product not found returns 404', async () => {
    const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
    mockPool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[], []]);
    const res = await request(app)
      .post('/api/forecast/stock')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ product_id: 999 });
    expect(res.status).toBe(404);
  });

  test('POST /api/forecast/stock forecast not found returns 404', async () => {
    const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
    mockPool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id: 1, name: 'P', stock: 1, unit: 'pcs' }], []])
      .mockResolvedValueOnce([[], []]);
    const res = await request(app)
      .post('/api/forecast/stock')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ product_id: 1 });
    expect(res.status).toBe(404);
  });

  test('POST /api/forecast/stock returns recommendation', async () => {
    const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
    mockPool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id: 1, name: 'P', stock: 1, unit: 'pcs' }], []])
      .mockResolvedValueOnce([[{ metode: 'gemini', alasan_fallback: null, lead_time: 7, kebutuhan_7_hari: 3, perkiraan_penjualan_per_hari: 1, tambahan_stok: 2, satuan: 'pcs', debug_prompt: null, debug_response: null }], []]);

    const res = await request(app)
      .post('/api/forecast/stock')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ product_id: 1 });
    expect(res.status).toBe(200);
    expect(res.body.rekomendasi.tambahan_stok).toBe(2);
  });

  test('POST /api/forecast-openrouter/stock returns recommendation', async () => {
    const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
    mockPool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id: 1, name: 'P', stock: 1, unit: 'pcs' }], []])
      .mockResolvedValueOnce([[{ metode: 'openrouter', alasan_fallback: null, lead_time: 7, kebutuhan_7_hari: 3, perkiraan_penjualan_per_hari: 1, tambahan_stok: 2, satuan: 'pcs', debug_prompt: null, debug_response: null }], []]);

    const res = await request(app)
      .post('/api/forecast-openrouter/stock')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ product_id: 1 });
    expect(res.status).toBe(200);
    expect(res.body.rekomendasi.tambahan_stok).toBe(2);
  });
});
