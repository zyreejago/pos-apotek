jest.mock('../utils/journal', () => ({ createJournalEntry: jest.fn() }));

const express = require('express');
const request = require('supertest');

const registerInventoryRoutes = require('../routes/inventory');
const { createJournalEntry } = require('../utils/journal');

function buildApp({ pool, user }) {
  const app = express();
  app.use(express.json());

  const authenticate = (req, _res, next) => {
    req.user = user || { id: 1, username: 'admin', role: 'superadmin' };
    next();
  };
  const checkPermission = () => (_req, _res, next) => next();
  const createAuditTrail = jest.fn().mockResolvedValue(undefined);
  const upload = { single: () => (req, _res, next) => next() };

  registerInventoryRoutes(app, pool, authenticate, checkPermission, upload, createAuditTrail);
  return { app, createAuditTrail };
}

describe('inventory module', () => {
  beforeEach(() => {
    createJournalEntry.mockReset();
  });

  describe('GET /api/inventory/batches/:productId', () => {
    test('returns batches with dp_payments, qty_returned, qty_restored', async () => {
      const batch = { id: 1, product_id: 1, supplier_name: 'S', expired_date: '2026-12-31', is_archived: false };
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[batch], []])
          .mockResolvedValueOnce([[{ id: 1, amount: 5000 }], []])
          .mockResolvedValueOnce([[{ qty: 2 }], []])
          .mockResolvedValueOnce([[{ qty: 1 }], []]),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/inventory/batches/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].dp_payments).toEqual([{ id: 1, amount: 5000 }]);
      expect(res.body.data[0].qty_returned).toBe(2);
      expect(res.body.data[0].qty_restored).toBe(1);
    });

    test('handles dp_payments query error gracefully', async () => {
      const batch = { id: 1, product_id: 1, supplier_name: 'S', expired_date: null, is_archived: false };
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[batch], []])
          .mockRejectedValueOnce(new Error('dp err'))
          .mockResolvedValueOnce([[{ qty: 2 }], []])
          .mockResolvedValueOnce([[{ qty: 1 }], []]),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/inventory/batches/1');

      expect(res.status).toBe(200);
      expect(res.body.data[0].dp_payments).toEqual([]);
      expect(res.body.data[0].qty_returned).toBe(2);
      expect(res.body.data[0].qty_restored).toBe(1);
    });

    test('handles qty_returned query error gracefully', async () => {
      const batch = { id: 1, product_id: 1, supplier_name: 'S', expired_date: null, is_archived: false };
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[batch], []])
          .mockResolvedValueOnce([[{ id: 1, amount: 5000 }], []])
          .mockRejectedValueOnce(new Error('ret err'))
          .mockResolvedValueOnce([[{ qty: 1 }], []]),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/inventory/batches/1');

      expect(res.status).toBe(200);
      expect(res.body.data[0].qty_returned).toBe(0);
      expect(res.body.data[0].qty_restored).toBe(1);
    });

    test('handles qty_restored query error gracefully', async () => {
      const batch = { id: 1, product_id: 1, supplier_name: 'S', expired_date: null, is_archived: false };
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[batch], []])
          .mockResolvedValueOnce([[{ id: 1, amount: 5000 }], []])
          .mockResolvedValueOnce([[{ qty: 2 }], []])
          .mockRejectedValueOnce(new Error('restore err')),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/inventory/batches/1');

      expect(res.status).toBe(200);
      expect(res.body.data[0].qty_restored).toBe(0);
    });

    test('returns empty array when no batches', async () => {
      const pool = { query: jest.fn().mockResolvedValueOnce([[], []]) };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/inventory/batches/1');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    test('returns 500 on database error', async () => {
      const pool = { query: jest.fn().mockRejectedValueOnce(new Error('db')) };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/inventory/batches/1');

      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/inventory/batches/:batchId/dp-payments', () => {
    test('returns 400 when amount is missing or <= 0', async () => {
      const pool = { getConnection: jest.fn() };
      const { app } = buildApp({ pool });

      const res1 = await request(app)
        .post('/api/inventory/batches/1/dp-payments')
        .send({ amount: 0 });
      expect(res1.status).toBe(400);

      const res2 = await request(app)
        .post('/api/inventory/batches/1/dp-payments')
        .send({});
      expect(res2.status).toBe(400);
    });

    test('returns 200 with cash payment method', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([[{ product_name: 'Product A' }], []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app, createAuditTrail } = buildApp({ pool });

      const res = await request(app)
        .post('/api/inventory/batches/1/dp-payments')
        .send({ amount: 50000, payment_method: 'cash', notes: 'DP 1' });

      expect(res.status).toBe(200);
      expect(createJournalEntry).toHaveBeenCalledWith(
        connection, null, expect.any(String),
        expect.stringContaining('Pembayaran DP supplier'),
        expect.arrayContaining([
          { accountCode: '201', debit: 50000 },
          { accountCode: '101', credit: 50000 },
        ])
      );
      expect(connection.commit).toHaveBeenCalled();
      expect(createAuditTrail).toHaveBeenCalled();
    });

    test('returns 200 with transfer payment method', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([[{ product_name: 'Product B' }], []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app)
        .post('/api/inventory/batches/1/dp-payments')
        .send({ amount: 100000, payment_method: 'transfer' });

      expect(res.status).toBe(200);
      expect(createJournalEntry).toHaveBeenCalledWith(
        connection, null, expect.any(String),
        expect.any(String),
        expect.arrayContaining([
          { accountCode: '201', debit: 100000 },
          { accountCode: '102', credit: 100000 },
        ])
      );
    });

    test('uses batch id as fallback when product name not found', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([[], []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app)
        .post('/api/inventory/batches/99/dp-payments')
        .send({ amount: 25000 });

      expect(res.status).toBe(200);
      expect(createJournalEntry).toHaveBeenCalledWith(
        connection, null, expect.any(String),
        expect.stringContaining('Batch #99'),
        expect.any(Array)
      );
    });

    test('rolls back transaction on error and returns 500', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn().mockRejectedValueOnce(new Error('insert failed')),
        commit: jest.fn(),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app)
        .post('/api/inventory/batches/1/dp-payments')
        .send({ amount: 50000 });

      expect(res.status).toBe(500);
      expect(connection.rollback).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/inventory/batches/:batchId/dp-payments/:paymentId', () => {
    test('returns 200 on success', async () => {
      const pool = { query: jest.fn().mockResolvedValueOnce([{}, []]) };
      const { app, createAuditTrail } = buildApp({ pool });

      const res = await request(app).delete('/api/inventory/batches/1/dp-payments/5');

      expect(res.status).toBe(200);
      expect(pool.query).toHaveBeenCalledWith('DELETE FROM batch_dp_payments WHERE id = ?', ['5']);
      expect(createAuditTrail).toHaveBeenCalled();
    });

    test('returns 500 on database error', async () => {
      const pool = { query: jest.fn().mockRejectedValueOnce(new Error('db')) };
      const { app } = buildApp({ pool });

      const res = await request(app).delete('/api/inventory/batches/1/dp-payments/5');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/inventory/history', () => {
    test('returns all batches with dp_payments', async () => {
      const batch = { id: 1, product_id: 1, supplier_name: 'S', product_name: 'P' };
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[batch], []])
          .mockResolvedValueOnce([[{ id: 1, amount: 5000 }], []]),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/inventory/history');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].dp_payments).toEqual([{ id: 1, amount: 5000 }]);
    });

    test('handles dp_payments query error gracefully', async () => {
      const batch = { id: 1, product_id: 1, supplier_name: 'S', product_name: 'P' };
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[batch], []])
          .mockRejectedValueOnce(new Error('dp err')),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/inventory/history');

      expect(res.status).toBe(200);
      expect(res.body.data[0].dp_payments).toEqual([]);
    });

    test('returns empty array when no history', async () => {
      const pool = { query: jest.fn().mockResolvedValueOnce([[], []]) };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/inventory/history');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    test('returns 500 on database error', async () => {
      const pool = { query: jest.fn().mockRejectedValueOnce(new Error('db')) };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/inventory/history');

      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/inventory/batches/:id/archive', () => {
    test('returns 404 when batch not found', async () => {
      const pool = { query: jest.fn().mockResolvedValueOnce([[], []]) };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/999/archive').send({ is_archived: true });

      expect(res.status).toBe(404);
    });

    test('returns 400 when stock_type is not lunas or retur', async () => {
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[{ stock_type: 'dp', initial_quantity: 10 }], []]),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/1/archive').send({ is_archived: true });

      expect(res.status).toBe(400);
    });

    test('returns 400 when retur stock not fully returned', async () => {
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[{ stock_type: 'retur', initial_quantity: 10 }], []])
          .mockResolvedValueOnce([[{ qty: 5 }], []]),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/1/archive').send({ is_archived: true });

      expect(res.status).toBe(400);
    });

    test('archives a lunas batch successfully', async () => {
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[{ stock_type: 'lunas', initial_quantity: 10 }], []])
          .mockResolvedValueOnce([{}, []]),
      };
      const { app, createAuditTrail } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/1/archive').send({ is_archived: true });

      expect(res.status).toBe(200);
      expect(pool.query).toHaveBeenLastCalledWith(
        'UPDATE batches SET is_archived = ? WHERE id = ?',
        [1, '1']
      );
      expect(createAuditTrail).toHaveBeenCalled();
    });

    test('unarchives a batch successfully', async () => {
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[{ stock_type: 'lunas', initial_quantity: 10 }], []])
          .mockResolvedValueOnce([{}, []]),
      };
      const { app, createAuditTrail } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/1/archive').send({ is_archived: false });

      expect(res.status).toBe(200);
      expect(pool.query).toHaveBeenLastCalledWith(
        'UPDATE batches SET is_archived = ? WHERE id = ?',
        [0, '1']
      );
    });

    test('archives a retur batch with all qty returned', async () => {
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[{ stock_type: 'retur', initial_quantity: 10 }], []])
          .mockResolvedValueOnce([[{ qty: 10 }], []])
          .mockResolvedValueOnce([{}, []]),
      };
      const { app, createAuditTrail } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/1/archive').send({ is_archived: true });

      expect(res.status).toBe(200);
      expect(createAuditTrail).toHaveBeenCalled();
    });

    test('returns 500 on database error', async () => {
      const pool = { query: jest.fn().mockRejectedValueOnce(new Error('db')) };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/1/archive').send({ is_archived: true });

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/inventory/pending-batches', () => {
    test('returns pending/revision/rejected batches', async () => {
      const rows = [
        { id: 1, status: 'pending', supplier_name: 'S', product_name: 'P' },
        { id: 2, status: 'revision', supplier_name: 'S2', product_name: 'P2' },
      ];
      const pool = { query: jest.fn().mockResolvedValueOnce([rows, []]) };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/inventory/pending-batches');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    test('returns empty array when none pending', async () => {
      const pool = { query: jest.fn().mockResolvedValueOnce([[], []]) };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/inventory/pending-batches');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    test('returns 500 on database error', async () => {
      const pool = { query: jest.fn().mockRejectedValueOnce(new Error('db')) };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/inventory/pending-batches');

      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/inventory/batches', () => {
    const defaultBody = {
      product_id: 1,
      supplier_id: '1',
      stock_type: 'lunas',
      purchase_date: '2026-06-01',
      initial_quantity: 10,
      cost_price: 5000,
    };

    test('creates batch auto-approved when under 2M', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([[{ name: 'Product A' }], []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = {
        query: jest.fn().mockResolvedValueOnce([{ insertId: 10 }, []]),
        getConnection: jest.fn().mockResolvedValue(connection),
      };
      const { app, createAuditTrail } = buildApp({ pool });

      const res = await request(app).post('/api/inventory/batches').send(defaultBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(10);
      expect(res.body.data.status).toBe('approved');
      expect(createJournalEntry).toHaveBeenCalledWith(
        connection, null, '2026-06-01',
        expect.stringContaining('Pembelian stok'),
        expect.arrayContaining([
          { accountCode: '110', debit: 50000 },
          { accountCode: '101', credit: 50000 },
        ])
      );
      expect(connection.commit).toHaveBeenCalled();
      expect(createAuditTrail).toHaveBeenCalled();
    });

    test('creates batch with status pending when over 2M', async () => {
      const pool = {
        query: jest.fn().mockResolvedValueOnce([{ insertId: 20 }, []]),
        getConnection: jest.fn(),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/inventory/batches').send({
        ...defaultBody,
        initial_quantity: 100,
        cost_price: 30000,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('pending');
      expect(pool.getConnection).not.toHaveBeenCalled();
    });

    test('creates batch with dp stock type and auto-creates dp payment', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([[{ name: 'Product A' }], []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([{ insertId: 30 }, []])
          .mockResolvedValueOnce([{}, []]),
        getConnection: jest.fn().mockResolvedValue(connection),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/inventory/batches').send({
        ...defaultBody,
        stock_type: 'dp',
        dp_amount: 20000,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('approved');
      expect(pool.query).toHaveBeenCalledWith(
        'INSERT INTO batch_dp_payments (batch_id, amount, payment_date, payment_method, notes) VALUES (?, ?, ?, ?, ?)',
        [30, 20000, '2026-06-01', 'cash', 'DP 1 (saat pembuatan faktur)']
      );
      expect(createJournalEntry).toHaveBeenCalledWith(
        connection, null, '2026-06-01',
        expect.any(String),
        expect.arrayContaining([
          { accountCode: '110', debit: 50000 },
          { accountCode: '101', credit: 20000 },
          { accountCode: '201', credit: 30000 },
        ])
      );
    });

    test('creates batch with hutang stock type (belum_bayar)', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([[{ name: 'Product A' }], []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = {
        query: jest.fn().mockResolvedValueOnce([{ insertId: 40 }, []]),
        getConnection: jest.fn().mockResolvedValue(connection),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/inventory/batches').send({
        ...defaultBody,
        stock_type: 'belum_bayar',
      });

      expect(res.status).toBe(200);
      expect(createJournalEntry).toHaveBeenCalledWith(
        connection, null, '2026-06-01',
        expect.any(String),
        expect.arrayContaining([
          { accountCode: '110', debit: 50000 },
          { accountCode: '201', credit: 50000 },
        ])
      );
    });

    test('creates batch with supplier_id empty string treats as null', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([[{ name: 'Product A' }], []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = {
        query: jest.fn().mockResolvedValueOnce([{ insertId: 50 }, []]),
        getConnection: jest.fn().mockResolvedValue(connection),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/inventory/batches').send({
        ...defaultBody,
        supplier_id: '',
      });

      expect(res.status).toBe(200);
    });

    test('continues even when stock update transaction fails', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn().mockRejectedValueOnce(new Error('stock update failed')),
        commit: jest.fn(),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = {
        query: jest.fn().mockResolvedValueOnce([{ insertId: 60 }, []]),
        getConnection: jest.fn().mockResolvedValue(connection),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/inventory/batches').send(defaultBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(connection.rollback).toHaveBeenCalled();
    });

    test('returns 500 when insert query fails', async () => {
      const pool = { query: jest.fn().mockRejectedValueOnce(new Error('insert failed')) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/inventory/batches').send(defaultBody);

      expect(res.status).toBe(500);
    });

    test('handles auto-create DP payment failure gracefully (line 292)', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([[{ name: 'Product A' }], []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([{ insertId: 35 }, []])
          .mockRejectedValueOnce(new Error('dp insert failed')),
        getConnection: jest.fn().mockResolvedValue(connection),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/inventory/batches').send({
        ...defaultBody,
        stock_type: 'dp',
        dp_amount: 20000,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('PUT /api/inventory/batches/:id', () => {
    const defaultUpdate = {
      supplier_id: '1',
      stock_type: 'lunas',
      purchase_date: '2026-06-01',
      initial_quantity: 10,
      remaining_quantity: 10,
      cost_price: 5000,
    };

    test('returns 404 when batch not found', async () => {
      const pool = { query: jest.fn().mockResolvedValueOnce([[], []]) };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/999').send(defaultUpdate);

      expect(res.status).toBe(404);
    });

    test('returns 400 when trying to edit retur stock type manually', async () => {
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[{ stock_type: 'retur', remaining_quantity: 10, product_id: 1, image_url: null, status: 'approved' }], []]),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/1').send({
        ...defaultUpdate,
        stock_type: 'lunas',
      });

      expect(res.status).toBe(400);
    });

    test('returns 400 when trying to change stock_type to retur', async () => {
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[{ stock_type: 'lunas', remaining_quantity: 10, product_id: 1, image_url: null, status: 'approved' }], []]),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/1').send({
        ...defaultUpdate,
        stock_type: 'retur',
      });

      expect(res.status).toBe(400);
    });

    test('updates batch and adjusts stock when old->approved and new->approved', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([[{ name: 'Product A', product_category: 'OBAT' }], []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[{
            remaining_quantity: 5, product_id: 1, image_url: null, status: 'approved', stock_type: 'lunas'
          }], []])
          .mockResolvedValueOnce([{}, []]),
        getConnection: jest.fn().mockResolvedValue(connection),
      };
      const { app, createAuditTrail } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/1').send(defaultUpdate);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(connection.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('UPDATE products'),
        [5, 1]
      );
      expect(createJournalEntry).toHaveBeenCalled();
      expect(createAuditTrail).toHaveBeenCalled();
      expect(connection.commit).toHaveBeenCalled();
    });

    test('updates batch adding stock when transitioning from pending to approved', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([[{ name: 'Product B', product_category: 'NON_OBAT' }], []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[{
            remaining_quantity: 10, product_id: 2, image_url: null, status: 'pending', stock_type: 'lunas'
          }], []])
          .mockResolvedValueOnce([{}, []]),
        getConnection: jest.fn().mockResolvedValue(connection),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/2').send(defaultUpdate);

      expect(res.status).toBe(200);
      expect(connection.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('UPDATE products'),
        [10, 2]
      );
      expect(createJournalEntry).toHaveBeenCalledWith(
        connection, null, expect.any(String),
        expect.any(String),
        expect.arrayContaining([
          { accountCode: '104', debit: 50000 },
          { accountCode: '101', credit: 50000 },
        ])
      );
    });

    test('handles zero stock diff when old and new quantities match', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([[{ name: 'Product A', product_category: 'OBAT' }], []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[{
            remaining_quantity: 10, product_id: 1, image_url: null, status: 'approved', stock_type: 'lunas'
          }], []])
          .mockResolvedValueOnce([{}, []]),
        getConnection: jest.fn().mockResolvedValue(connection),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/1').send(defaultUpdate);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('approved');
      expect(connection.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('GREATEST'),
        [0, 1]
      );
    });

    test('clears revision notes when status becomes approved', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([[{ name: 'Product A', product_category: 'OBAT' }], []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[{
            remaining_quantity: 10, product_id: 1, image_url: null, status: 'revision', stock_type: 'lunas'
          }], []])
          .mockResolvedValueOnce([{}, []]),
        getConnection: jest.fn().mockResolvedValue(connection),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/1').send({
        ...defaultUpdate,
        notes: 'should be cleared',
      });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('approved');
    });

    test('returns 500 on database error', async () => {
      const pool = { query: jest.fn().mockRejectedValueOnce(new Error('db')) };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/1').send(defaultUpdate);

      expect(res.status).toBe(500);
    });

    test('sets status to pending when total exceeds 2M and oldStatus is not approved (lines 397-398)', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[{
            remaining_quantity: 10, product_id: 1, image_url: null, status: 'revision', stock_type: 'lunas', cost_price: 5000, initial_quantity: 10, dp_amount: null,
          }], []])
          .mockResolvedValueOnce([{}, []]),
        getConnection: jest.fn().mockResolvedValue(connection),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/1').send({
        supplier_id: '1',
        stock_type: 'lunas',
        purchase_date: '2026-06-01',
        initial_quantity: 100,
        remaining_quantity: 10,
        cost_price: 30000,
      });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('pending');
    });

    test('creates journal with dp stock type in update route (lines 468-471)', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([[{ name: 'Product A', product_category: 'OBAT' }], []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[{
            remaining_quantity: 10, product_id: 1, image_url: null, status: 'revision', stock_type: 'belum_bayar', cost_price: 5000, initial_quantity: 10, dp_amount: null,
          }], []])
          .mockResolvedValueOnce([{}, []]),
        getConnection: jest.fn().mockResolvedValue(connection),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/1').send({
        supplier_id: '1',
        stock_type: 'dp',
        purchase_date: '2026-06-01',
        initial_quantity: 10,
        remaining_quantity: 10,
        cost_price: 5000,
        dp_amount: 20000,
      });

      expect(res.status).toBe(200);
      expect(createJournalEntry).toHaveBeenCalledWith(
        connection, null, expect.any(String),
        expect.any(String),
        expect.arrayContaining([
          { accountCode: '103', debit: 50000 },
          { accountCode: '101', credit: 20000 },
          { accountCode: '201', credit: 30000 },
        ])
      );
    });

    test('creates debt payment journal when transitioning from belum_bayar to lunas (lines 477-489)', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([[{ name: 'Product A', product_category: 'OBAT' }], []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[{
            remaining_quantity: 10, product_id: 1, image_url: null, status: 'approved', stock_type: 'belum_bayar', cost_price: 5000, initial_quantity: 10, dp_amount: null,
          }], []])
          .mockResolvedValueOnce([{}, []]),
        getConnection: jest.fn().mockResolvedValue(connection),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/1').send({
        supplier_id: '1',
        stock_type: 'lunas',
        purchase_date: '2026-06-01',
        initial_quantity: 10,
        remaining_quantity: 10,
        cost_price: 5000,
      });

      expect(res.status).toBe(200);
      expect(createJournalEntry).toHaveBeenCalledWith(
        connection, null, expect.any(String),
        expect.stringContaining('Pembayaran hutang'),
        [
          { accountCode: '201', debit: 50000 },
          { accountCode: '101', credit: 50000 },
        ]
      );
    });

    test('creates journal with belum_bayar stock type else branch in update route (line 471)', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([[{ name: 'Product B', product_category: 'NON_OBAT' }], []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[{
            remaining_quantity: 10, product_id: 2, image_url: null, status: 'revision', stock_type: 'lunas', cost_price: 5000, initial_quantity: 10, dp_amount: null,
          }], []])
          .mockResolvedValueOnce([{}, []]),
        getConnection: jest.fn().mockResolvedValue(connection),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/2').send({
        supplier_id: '1',
        stock_type: 'belum_bayar',
        purchase_date: '2026-06-01',
        initial_quantity: 10,
        remaining_quantity: 10,
        cost_price: 5000,
      });

      expect(res.status).toBe(200);
      expect(createJournalEntry).toHaveBeenCalledWith(
        connection, null, expect.any(String),
        expect.any(String),
        expect.arrayContaining([
          { accountCode: '104', debit: 50000 },
          { accountCode: '201', credit: 50000 },
        ])
      );
    });

    test('rolls back transaction on query failure during update (lines 500-501)', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([{}, []])
          .mockRejectedValueOnce(new Error('stock update failed')),
        commit: jest.fn(),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[{
            remaining_quantity: 10, product_id: 1, image_url: null, status: 'approved', stock_type: 'lunas', cost_price: 5000, initial_quantity: 10, dp_amount: null,
          }], []])
          .mockResolvedValueOnce([{}, []]),
        getConnection: jest.fn().mockResolvedValue(connection),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/1').send(defaultUpdate);

      expect(res.status).toBe(200);
      expect(connection.rollback).toHaveBeenCalled();
      expect(connection.release).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/inventory/batches/:id', () => {
    test('deletes batch and updates stock when batch exists', async () => {
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[{ product_id: 1, remaining_quantity: 10 }], []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []]),
      };
      const { app, createAuditTrail } = buildApp({ pool });

      const res = await request(app).delete('/api/inventory/batches/1');

      expect(res.status).toBe(200);
      expect(pool.query).toHaveBeenCalledWith('DELETE FROM batches WHERE id = ?', ['1']);
      expect(createAuditTrail).toHaveBeenCalled();
    });

    test('deletes batch without stock update when batch not found', async () => {
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([{}, []]),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).delete('/api/inventory/batches/999');

      expect(res.status).toBe(200);
    });

    test('returns 500 on database error', async () => {
      const pool = { query: jest.fn().mockRejectedValueOnce(new Error('db')) };
      const { app } = buildApp({ pool });

      const res = await request(app).delete('/api/inventory/batches/1');

      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/inventory/batches/:id/expire', () => {
    test('returns 404 when batch not found', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn().mockResolvedValueOnce([[], []]),
        commit: jest.fn(),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/999/expire');

      expect(res.status).toBe(404);
    });

    test('returns 400 when batch has no remaining stock', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn().mockResolvedValueOnce([[{ remaining_quantity: 0 }], []]),
        commit: jest.fn(),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/1/expire');

      expect(res.status).toBe(400);
    });

    test('expires OBAT batch and creates journal', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[{ id: 1, product_id: 1, remaining_quantity: 10, cost_price: 5000 }], []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([[{ name: 'Product A', product_category: 'OBAT', cost_price: 5000 }], []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/1/expire');

      expect(res.status).toBe(200);
      expect(createJournalEntry).toHaveBeenCalledWith(
        connection, null, expect.any(String),
        expect.stringContaining('Obat/Barang Expired'),
        [
          { accountCode: '526', debit: 50000 },
          { accountCode: '103', credit: 50000 },
        ]
      );
      expect(connection.commit).toHaveBeenCalled();
    });

    test('expires NON_OBAT batch and creates journal', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[{ id: 2, product_id: 2, remaining_quantity: 5, cost_price: 3000 }], []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([[{ name: 'Product B', product_category: 'NON_OBAT', cost_price: 3000 }], []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/2/expire');

      expect(res.status).toBe(200);
      expect(createJournalEntry).toHaveBeenCalledWith(
        connection, null, expect.any(String),
        expect.stringContaining('Obat/Barang Expired'),
        [
          { accountCode: '526', debit: 15000 },
          { accountCode: '104', credit: 15000 },
        ]
      );
    });

    test('returns 500 on database error', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn().mockRejectedValueOnce(new Error('db')),
        commit: jest.fn(),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/1/expire');

      expect(res.status).toBe(500);
      expect(connection.rollback).toHaveBeenCalled();
    });
  });

  describe('PUT /api/inventory/batches/:id/approve', () => {
    const makeBatch = (overrides = {}) => ({
      id: 1, product_id: 1, remaining_quantity: 10, initial_quantity: 10,
      cost_price: 5000, stock_type: 'lunas', dp_amount: null, status: 'pending',
      purchase_date: '2026-01-15', ...overrides,
    });

    test('returns 404 when batch not found', async () => {
      const pool = { query: jest.fn().mockResolvedValueOnce([[], []]) };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/999/approve');

      expect(res.status).toBe(404);
    });

    test('returns 400 when batch already approved', async () => {
      const pool = { query: jest.fn().mockResolvedValueOnce([[{ ...makeBatch(), status: 'approved' }], []]) };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/1/approve');

      expect(res.status).toBe(400);
    });

    test('approves a lunas batch', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([[{ name: 'Product A', product_category: 'OBAT' }], []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = {
        query: jest.fn().mockResolvedValueOnce([[makeBatch()], []]),
        getConnection: jest.fn().mockResolvedValue(connection),
      };
      const { app, createAuditTrail } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/1/approve');

      expect(res.status).toBe(200);
      expect(createJournalEntry).toHaveBeenCalledWith(
        connection, null, '2026-01-15',
        expect.stringContaining('Pembelian stok (Approved)'),
        [
          { accountCode: '103', debit: 50000 },
          { accountCode: '101', credit: 50000 },
        ]
      );
      expect(connection.commit).toHaveBeenCalled();
      expect(createAuditTrail).toHaveBeenCalled();
    });

    test('approves a dp batch', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([[{ name: 'Product B', product_category: 'NON_OBAT' }], []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = {
        query: jest.fn().mockResolvedValueOnce([[makeBatch({ stock_type: 'dp', dp_amount: 20000 })], []]),
        getConnection: jest.fn().mockResolvedValue(connection),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/1/approve');

      expect(res.status).toBe(200);
      expect(createJournalEntry).toHaveBeenCalledWith(
        connection, null, '2026-01-15',
        expect.any(String),
        [
          { accountCode: '104', debit: 50000 },
          { accountCode: '101', credit: 20000 },
          { accountCode: '201', credit: 30000 },
        ]
      );
    });

    test('approves a belum_bayar batch', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([[{ name: 'Product C', product_category: 'OBAT' }], []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = {
        query: jest.fn().mockResolvedValueOnce([[makeBatch({ stock_type: 'belum_bayar' })], []]),
        getConnection: jest.fn().mockResolvedValue(connection),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/1/approve');

      expect(res.status).toBe(200);
      expect(createJournalEntry).toHaveBeenCalledWith(
        connection, null, '2026-01-15',
        expect.any(String),
        [
          { accountCode: '103', debit: 50000 },
          { accountCode: '201', credit: 50000 },
        ]
      );
    });

    test('returns 500 when transaction fails', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn().mockRejectedValueOnce(new Error('txn failed')),
        commit: jest.fn(),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = {
        query: jest.fn().mockResolvedValueOnce([[makeBatch()], []]),
        getConnection: jest.fn().mockResolvedValue(connection),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/1/approve');

      expect(res.status).toBe(500);
      expect(connection.rollback).toHaveBeenCalled();
    });

    test('returns 500 when outer query fails', async () => {
      const pool = { query: jest.fn().mockRejectedValueOnce(new Error('db')) };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/1/approve');

      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/inventory/batches/:id/reject', () => {
    test('returns 404 when batch not found', async () => {
      const pool = { query: jest.fn().mockResolvedValueOnce([[], []]) };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/999/reject');

      expect(res.status).toBe(404);
    });

    test('returns 400 when batch already rejected', async () => {
      const pool = { query: jest.fn().mockResolvedValueOnce([[{ status: 'rejected' }], []]) };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/1/reject');

      expect(res.status).toBe(400);
    });

    test('rejects a batch successfully', async () => {
      const pool = { query: jest.fn().mockResolvedValueOnce([[{ status: 'pending' }], []]) };
      const { app, createAuditTrail } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/1/reject');

      expect(res.status).toBe(200);
      expect(createAuditTrail).toHaveBeenCalled();
    });

    test('returns 500 on database error', async () => {
      const pool = { query: jest.fn().mockRejectedValueOnce(new Error('db')) };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/1/reject');

      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/inventory/batches/:id/revision', () => {
    test('requests revision successfully', async () => {
      const pool = { query: jest.fn().mockResolvedValueOnce([{}, []]) };
      const { app, createAuditTrail } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/1/revision').send({ notes: 'Fix invoice' });

      expect(res.status).toBe(200);
      expect(pool.query).toHaveBeenCalledWith(
        'UPDATE batches SET status = ?, notes = ? WHERE id = ?',
        ['revision', 'Fix invoice', '1']
      );
      expect(createAuditTrail).toHaveBeenCalled();
    });

    test('sets notes to null when not provided', async () => {
      const pool = { query: jest.fn().mockResolvedValueOnce([{}, []]) };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/1/revision').send({});

      expect(res.status).toBe(200);
      expect(pool.query).toHaveBeenCalledWith(
        'UPDATE batches SET status = ?, notes = ? WHERE id = ?',
        ['revision', null, '1']
      );
    });

    test('returns 500 on database error', async () => {
      const pool = { query: jest.fn().mockRejectedValueOnce(new Error('db')) };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/batches/1/revision');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/inventory/prescriptions', () => {
    test('returns prescriptions with items', async () => {
      const prescription = { id: 1, prescription_code: 'RX-001', entered_by_name: 'admin' };
      const items = [{ id: 1, prescription_id: 1, product_name: 'Product A', quantity: 2 }];
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[prescription], []])
          .mockResolvedValueOnce([items, []]),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/inventory/prescriptions');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].items).toEqual(items);
    });

    test('returns empty array when no prescriptions', async () => {
      const pool = { query: jest.fn().mockResolvedValueOnce([[], []]) };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/inventory/prescriptions');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    test('returns 500 on database error', async () => {
      const pool = { query: jest.fn().mockRejectedValueOnce(new Error('db')) };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/inventory/prescriptions');

      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/inventory/prescriptions', () => {
    test('creates prescription without items', async () => {
      const pool = { query: jest.fn().mockResolvedValueOnce([{ insertId: 1 }, []]) };
      const { app, createAuditTrail } = buildApp({ pool });

      const res = await request(app).post('/api/inventory/prescriptions').send({
        prescription_code: 'RX-001',
        prescription_date: '2026-06-01',
        entered_by: 1,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(1);
      expect(createAuditTrail).toHaveBeenCalled();
    });

    test('creates prescription with items as JSON string', async () => {
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([{ insertId: 2 }, []])
          .mockResolvedValueOnce([{}, []]),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/inventory/prescriptions').send({
        prescription_code: 'RX-002',
        entered_by: 1,
        items: JSON.stringify([
          { product_id: 1, quantity: 2, selling_price: 5000 },
        ]),
      });

      expect(res.status).toBe(200);
    });

    test('creates prescription with items as array', async () => {
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([{ insertId: 3 }, []])
          .mockResolvedValueOnce([{}, []]),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/inventory/prescriptions').send({
        prescription_code: 'RX-003',
        entered_by: 1,
        items: [
          { product_id: 1, quantity: 2, selling_price: 5000 },
          { id: 2, quantity: 1, selling_price: 10000 },
        ],
      });

      expect(res.status).toBe(200);
    });

    test('returns 500 on database error', async () => {
      const pool = { query: jest.fn().mockRejectedValueOnce(new Error('db')) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/inventory/prescriptions').send({
        prescription_code: 'RX-001',
        entered_by: 1,
      });

      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/inventory/prescriptions/:id', () => {
    test('updates prescription without items', async () => {
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[{ image_url: 'old.jpg' }], []])
          .mockResolvedValueOnce([{}, []]),
      };
      const { app, createAuditTrail } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/prescriptions/1').send({
        prescription_code: 'RX-001',
        entered_by: 1,
      });

      expect(res.status).toBe(200);
      expect(createAuditTrail).toHaveBeenCalled();
    });

    test('updates prescription with items, replacing old ones', async () => {
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[{ image_url: 'old.jpg' }], []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []]),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/prescriptions/1').send({
        prescription_code: 'RX-001',
        entered_by: 1,
        items: [{ product_id: 1, quantity: 3, selling_price: 5000 }],
      });

      expect(res.status).toBe(200);
      expect(pool.query).toHaveBeenCalledWith(
        'DELETE FROM prescription_items WHERE prescription_id = ?',
        ['1']
      );
    });

    test('preserves existing image_url when no new file', async () => {
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[{ image_url: 'existing.jpg' }], []])
          .mockResolvedValueOnce([{}, []]),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/prescriptions/1').send({
        prescription_code: 'RX-001',
        entered_by: 1,
      });

      expect(res.status).toBe(200);
    });

    test('returns 500 on database error', async () => {
      const pool = { query: jest.fn().mockRejectedValueOnce(new Error('db')) };
      const { app } = buildApp({ pool });

      const res = await request(app).put('/api/inventory/prescriptions/1').send({
        prescription_code: 'RX-001',
        entered_by: 1,
      });

      expect(res.status).toBe(500);
    });

    test('updates prescription image_url when file is uploaded (line 821)', async () => {
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[{ image_url: 'old.jpg' }], []])
          .mockResolvedValueOnce([{}, []]),
      };
      const app = express();
      app.use(express.json());
      const authenticate = (req, _res, next) => {
        req.user = { id: 1, username: 'admin', role: 'superadmin' };
        next();
      };
      const checkPermission = () => (_req, _res, next) => next();
      const createAuditTrail = jest.fn().mockResolvedValue(undefined);
      const upload = { single: () => (req, _res, next) => { req.file = { filename: 'new-image.jpg' }; next(); } };
      registerInventoryRoutes(app, pool, authenticate, checkPermission, upload, createAuditTrail);

      const res = await request(app).put('/api/inventory/prescriptions/1').send({
        prescription_code: 'RX-001',
        entered_by: 1,
      });

      expect(res.status).toBe(200);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE prescriptions'),
        expect.arrayContaining(['/uploads/new-image.jpg'])
      );
    });
  });

  describe('DELETE /api/inventory/prescriptions/:id', () => {
    test('deletes prescription and its items', async () => {
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []]),
      };
      const { app, createAuditTrail } = buildApp({ pool });

      const res = await request(app).delete('/api/inventory/prescriptions/1');

      expect(res.status).toBe(200);
      expect(pool.query).toHaveBeenNthCalledWith(1, 'DELETE FROM prescription_items WHERE prescription_id = ?', ['1']);
      expect(pool.query).toHaveBeenNthCalledWith(2, 'DELETE FROM prescriptions WHERE id = ?', ['1']);
      expect(createAuditTrail).toHaveBeenCalled();
    });

    test('returns 500 on database error', async () => {
      const pool = { query: jest.fn().mockRejectedValueOnce(new Error('db')) };
      const { app } = buildApp({ pool });

      const res = await request(app).delete('/api/inventory/prescriptions/1');

      expect(res.status).toBe(500);
    });
  });
});
