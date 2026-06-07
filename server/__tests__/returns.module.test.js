const express = require('express');
const request = require('supertest');

jest.mock('../utils/journal', () => ({ createJournalEntry: jest.fn() }));

const registerReturnRoutes = require('../routes/returns');
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

  registerReturnRoutes(app, pool, authenticate, checkPermission, createAuditTrail);
  return { app, createAuditTrail };
}

describe('purchase returns', () => {
  beforeEach(() => {
    createJournalEntry.mockReset();
  });

  describe('GET /api/returns/purchases/lookup', () => {
    test('returns 400 when invoice_no is missing', async () => {
      const pool = { query: jest.fn() };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/returns/purchases/lookup');

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('invoice_no required');
    });

    test('returns 404 when no batches found', async () => {
      const pool = { query: jest.fn().mockResolvedValueOnce([[], []]) };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/returns/purchases/lookup?invoice_no=INV-999');

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Faktur tidak ditemukan');
    });

    test('returns 200 with items and handles purchaseItemId being null or present', async () => {
      const batch1 = {
        id: 1, supplier_id: 1, product_id: 10, supplier_name: 'Supplier A', accepts_return: 1,
        return_notes: null, product_name: 'Product A', product_category: 'OBAT',
        initial_quantity: 100, cost_price: 5000, batch_number: 'INV-001',
        expired_date: '2026-12-31', remaining_quantity: 80, purchase_date: '2026-01-15',
        created_at: '2026-01-15T00:00:00.000Z',
      };
      const batch2 = {
        id: 2, supplier_id: 1, product_id: 11, supplier_name: 'Supplier A', accepts_return: 1,
        return_notes: null, product_name: 'Product B', product_category: 'NON_OBAT',
        initial_quantity: 50, cost_price: 3000, batch_number: 'INV-001',
        expired_date: null, remaining_quantity: 50, purchase_date: '2026-01-15',
        created_at: '2026-01-15T00:00:00.000Z',
      };
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[batch1, batch2], []])
          .mockResolvedValueOnce([[{ purchase_item_id: 5 }], []])
          .mockResolvedValueOnce([[{ qty: 10 }], []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([[{ qty: 5 }], []]),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/returns/purchases/lookup?invoice_no=INV-001');

      expect(res.status).toBe(200);
      expect(res.body.supplier.name).toBe('Supplier A');
      expect(res.body.supplier.accepts_return).toBe(true);
      expect(res.body.purchase.invoice_no).toBe('INV-001');
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[0].purchase_item_id).toBe(5);
      expect(res.body.items[1].purchase_item_id).toBeNull();
      expect(res.body.items[0].qty_already_returned).toBe(10);
      expect(res.body.items[0].qty_returnable).toBe(90);
      expect(res.body.items[1].qty_already_returned).toBe(5);
      expect(res.body.items[1].qty_returnable).toBe(45);
    });

    test('returns 200 with accepts_return false and return_notes', async () => {
      const batch = {
        id: 1, supplier_id: 1, product_id: 10, supplier_name: 'Supplier A', accepts_return: 0,
        return_notes: 'No returns after 30 days', product_name: 'Product A', product_category: 'OBAT',
        initial_quantity: 100, cost_price: 5000, batch_number: 'INV-002',
        expired_date: null, remaining_quantity: 80, purchase_date: '2026-01-15',
        created_at: '2026-01-15T00:00:00.000Z',
      };
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[batch], []])
          .mockResolvedValueOnce([[{ purchase_item_id: 5 }], []])
          .mockResolvedValueOnce([[{ qty: 0 }], []]),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/returns/purchases/lookup?invoice_no=INV-002');

      expect(res.status).toBe(200);
      expect(res.body.supplier.accepts_return).toBe(false);
      expect(res.body.supplier.return_notes).toBe('No returns after 30 days');
    });

    test('returns 500 on error', async () => {
      const pool = { query: jest.fn().mockRejectedValueOnce(new Error('db error')) };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/returns/purchases/lookup?invoice_no=INV-001');

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Server error');
    });

    test('falls back to created_at when purchase_date is null (line 136)', async () => {
      const batch = {
        id: 1, supplier_id: 1, product_id: 10, supplier_name: 'Supplier A', accepts_return: 1,
        return_notes: null, product_name: 'Product A', product_category: 'OBAT',
        initial_quantity: 100, cost_price: 5000, batch_number: 'INV-003',
        expired_date: null, remaining_quantity: 80, purchase_date: null,
        created_at: '2026-02-01T00:00:00.000Z',
      };
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[batch], []])
          .mockResolvedValueOnce([[{ purchase_item_id: 5 }], []])
          .mockResolvedValueOnce([[{ qty: 0 }], []]),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/returns/purchases/lookup?invoice_no=INV-003');

      expect(res.status).toBe(200);
      expect(res.body.purchase.date).toBe(batch.created_at);
    });
  });

  describe('POST /api/returns/purchases', () => {
    test('returns 400 when items is empty', async () => {
      const pool = { getConnection: jest.fn() };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/purchases').send({
        invoice_no: 'INV-001',
        handling: 'reduce_payable',
        items: [],
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('items wajib diisi');
    });

    test('returns 400 when items is not an array', async () => {
      const pool = { getConnection: jest.fn() };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/purchases').send({
        invoice_no: 'INV-001',
        handling: 'reduce_payable',
        items: 'not-array',
      });

      expect(res.status).toBe(400);
    });

    test('returns 400 when handling is invalid', async () => {
      const pool = { getConnection: jest.fn() };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/purchases').send({
        invoice_no: 'INV-001',
        handling: 'invalid_handling',
        items: [{ batch_id: 1, qty_returned: 5, condition: 'good' }],
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Handling tidak valid');
    });

    test('returns 400 when both invoice_no and purchase_id are missing', async () => {
      const pool = { getConnection: jest.fn() };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/purchases').send({
        handling: 'reduce_payable',
        items: [{ batch_id: 1, qty_returned: 5, condition: 'good' }],
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('invoice_no atau purchase_id wajib diisi');
    });

    test('returns 400 when item is missing required fields', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[{ id: 1, supplier_id: 1, product_id: 10, initial_quantity: 100, cost_price: 5000, remaining_quantity: 100, batch_number: 'INV-001', expired_date: null, product_category: 'OBAT' }], []]),
        commit: jest.fn(),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/purchases').send({
        invoice_no: 'INV-001',
        handling: 'reduce_payable',
        items: [{ batch_id: 1 }],
      });

      expect(res.status).toBe(400);
      expect(connection.rollback).toHaveBeenCalled();
      expect(connection.release).toHaveBeenCalled();
    });

    test('returns 400 when qty_returned <= 0 (line 203)', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[{ id: 1, supplier_id: 1, product_id: 10, initial_quantity: 100, cost_price: 5000, remaining_quantity: 100, batch_number: 'INV-001', expired_date: null, product_category: 'OBAT' }], []])
          .mockResolvedValueOnce([[{ accepts_return: 1 }], []])
          .mockResolvedValueOnce([[{ id: 42 }], []])
          .mockResolvedValueOnce([[{ qty: 0 }], []]),
        commit: jest.fn(),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/purchases').send({
        invoice_no: 'INV-001',
        handling: 'reduce_payable',
        items: [{ batch_id: 1, qty_returned: -1, condition: 'good' }],
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('qty_returned harus > 0');
      expect(connection.rollback).toHaveBeenCalled();
    });

    test('returns 400 when batch not found in invoice (line 207)', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[{ id: 1, supplier_id: 1, product_id: 10, initial_quantity: 100, cost_price: 5000, remaining_quantity: 100, batch_number: 'INV-001', expired_date: null, product_category: 'OBAT' }], []])
          .mockResolvedValueOnce([[{ accepts_return: 1 }], []])
          .mockResolvedValueOnce([[{ id: 42 }], []])
          .mockResolvedValueOnce([[{ qty: 0 }], []]),
        commit: jest.fn(),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/purchases').send({
        invoice_no: 'INV-001',
        handling: 'reduce_payable',
        items: [{ batch_id: 999, qty_returned: 1, condition: 'good' }],
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('tidak ditemukan dalam faktur');
      expect(connection.rollback).toHaveBeenCalled();
    });

    test('returns 400 when qty_returned exceeds returnable qty', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[{ id: 1, supplier_id: 1, product_id: 10, initial_quantity: 10, cost_price: 5000, remaining_quantity: 10, batch_number: 'INV-001', expired_date: null, product_category: 'OBAT' }], []]),
        commit: jest.fn(),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/purchases').send({
        invoice_no: 'INV-001',
        handling: 'reduce_payable',
        items: [{ batch_id: 1, qty_returned: 20, condition: 'good' }],
      });

      expect(res.status).toBe(400);
      expect(connection.rollback).toHaveBeenCalled();
    });

    test('returns 400 when qty_returned exceeds current stock', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[{ id: 1, supplier_id: 1, product_id: 10, initial_quantity: 100, cost_price: 5000, remaining_quantity: 5, batch_number: 'INV-001', expired_date: null, product_category: 'OBAT' }], []])
          .mockResolvedValueOnce([[{ accepts_return: 1 }], []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([[{ total: 500000 }], []])
          .mockResolvedValueOnce([{ insertId: 10 }, []])
          .mockResolvedValueOnce([[{ qty: 0 }], []]),
        commit: jest.fn(),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/purchases').send({
        invoice_no: 'INV-001',
        handling: 'reduce_payable',
        items: [{ batch_id: 1, qty_returned: 10, condition: 'good' }],
      });

      expect(res.status).toBe(400);
      expect(connection.rollback).toHaveBeenCalled();
    });

    test('returns 400 when supplier does not accept returns and handling is not write_off_loss', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[{ id: 1, supplier_id: 1, product_id: 10, initial_quantity: 100, cost_price: 5000, remaining_quantity: 80, batch_number: 'INV-001', expired_date: null, product_category: 'OBAT' }], []])
          .mockResolvedValueOnce([[{ accepts_return: 0 }], []]),
        commit: jest.fn(),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/purchases').send({
        invoice_no: 'INV-001',
        handling: 'reduce_payable',
        items: [{ batch_id: 1, qty_returned: 5, condition: 'good' }],
      });

      expect(res.status).toBe(400);
      expect(connection.rollback).toHaveBeenCalled();
    });

    test('returns 400 when batchRows is empty', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[], []]),
        commit: jest.fn(),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/purchases').send({
        invoice_no: 'INV-999',
        handling: 'reduce_payable',
        items: [{ batch_id: 1, qty_returned: 5, condition: 'good' }],
      });

      expect(res.status).toBe(400);
      expect(connection.rollback).toHaveBeenCalled();
    });

    test('resolves batchNumber from purchase_id when invoice_no is not provided', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[{ invoice_no: 'INV-FROM-PURCHASE' }], []])
          .mockResolvedValueOnce([[{ id: 1, supplier_id: 1, product_id: 10, initial_quantity: 100, cost_price: 5000, remaining_quantity: 80, batch_number: 'INV-FROM-PURCHASE', expired_date: null, product_category: 'OBAT' }], []])
          .mockResolvedValueOnce([[{ accepts_return: 1 }], []])
          .mockResolvedValueOnce([[{ id: 42 }], []])
          .mockResolvedValueOnce([[{ qty: 0 }], []])
          .mockResolvedValueOnce([[{ id: 7 }], []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([{ insertId: 1 }, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app, createAuditTrail } = buildApp({ pool });

      const res = await request(app).post('/api/returns/purchases').send({
        purchase_id: 99,
        handling: 'reduce_payable',
        items: [{ batch_id: 1, qty_returned: 5, condition: 'good' }],
      });

      expect(res.status).toBe(201);
      expect(connection.commit).toHaveBeenCalled();
      expect(createAuditTrail).toHaveBeenCalled();
    });

    test('returns 201 with reduce_payable handling using existing purchase and purchase_item records', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[{ id: 1, supplier_id: 1, product_id: 10, initial_quantity: 100, cost_price: 5000, remaining_quantity: 80, batch_number: 'INV-001', expired_date: null, product_category: 'OBAT' }], []])
          .mockResolvedValueOnce([[{ accepts_return: 1 }], []])
          .mockResolvedValueOnce([[{ id: 42 }], []])
          .mockResolvedValueOnce([[{ qty: 20 }], []])
          .mockResolvedValueOnce([[{ id: 7 }], []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([{ insertId: 1 }, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app, createAuditTrail } = buildApp({ pool });

      const res = await request(app).post('/api/returns/purchases').send({
        invoice_no: 'INV-001',
        handling: 'reduce_payable',
        items: [{ batch_id: 1, qty_returned: 5, condition: 'rusak' }],
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.return_no).toContain('RP-');
      expect(res.body.id).toBe(1);
      expect(createJournalEntry).toHaveBeenCalledWith(
        connection, null, expect.any(String),
        expect.stringContaining('Retur pembelian (kurang hutang)'),
        expect.arrayContaining([
          expect.objectContaining({ accountCode: '103', credit: 25000 }),
          expect.objectContaining({ accountCode: '201', debit: 25000 }),
        ])
      );
      expect(connection.commit).toHaveBeenCalled();
      expect(connection.release).toHaveBeenCalled();
      expect(createAuditTrail).toHaveBeenCalledWith(expect.objectContaining({
        module: 'Retur Pembelian',
        action: 'create',
      }));
    });

    test('returns 201 with reduce_payable handling creating new purchase and purchase_item records', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[{ id: 1, supplier_id: 1, product_id: 10, initial_quantity: 100, cost_price: 5000, remaining_quantity: 80, batch_number: 'INV-001', expired_date: null, product_category: 'OBAT' }], []])
          .mockResolvedValueOnce([[{ accepts_return: 1 }], []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([[{ total: 500000 }], []])
          .mockResolvedValueOnce([{ insertId: 10 }, []])
          .mockResolvedValueOnce([[{ qty: 0 }], []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([{ insertId: 20 }, []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([{ insertId: 1 }, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/purchases').send({
        invoice_no: 'INV-001',
        handling: 'reduce_payable',
        reason: 'cacat produksi',
        items: [{ batch_id: 1, qty_returned: 10, condition: 'cacat' }],
      });

      expect(res.status).toBe(201);
      expect(res.body.return_no).toContain('RP-');
    });

    test('returns 201 with reduce_payable handling and non-obat product category', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[{ id: 2, supplier_id: 2, product_id: 20, initial_quantity: 200, cost_price: 2000, remaining_quantity: 150, batch_number: 'INV-002', expired_date: null, product_category: 'NON_OBAT' }], []])
          .mockResolvedValueOnce([[{ accepts_return: 1 }], []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([[{ total: 400000 }], []])
          .mockResolvedValueOnce([{ insertId: 11 }, []])
          .mockResolvedValueOnce([[{ qty: 0 }], []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([{ insertId: 21 }, []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([{ insertId: 2 }, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/purchases').send({
        invoice_no: 'INV-002',
        handling: 'reduce_payable',
        items: [{ batch_id: 2, qty_returned: 5, condition: 'expired' }],
      });

      expect(res.status).toBe(201);
      expect(createJournalEntry).toHaveBeenCalledWith(
        connection, null, expect.any(String),
        expect.stringContaining('Retur pembelian (kurang hutang)'),
        expect.arrayContaining([
          expect.objectContaining({ accountCode: '104', credit: 10000 }),
          expect.objectContaining({ accountCode: '201', debit: 10000 }),
        ])
      );
    });

    test('returns 201 with credit_note handling', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[{ id: 1, supplier_id: 1, product_id: 10, initial_quantity: 100, cost_price: 5000, remaining_quantity: 80, batch_number: 'INV-001', expired_date: null, product_category: 'OBAT' }], []])
          .mockResolvedValueOnce([[{ accepts_return: 1 }], []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([[{ total: 500000 }], []])
          .mockResolvedValueOnce([{ insertId: 10 }, []])
          .mockResolvedValueOnce([[{ qty: 0 }], []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([{ insertId: 20 }, []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([{ insertId: 1 }, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/purchases').send({
        invoice_no: 'INV-001',
        handling: 'credit_note',
        items: [{ batch_id: 1, qty_returned: 5, condition: 'baik' }],
      });

      expect(res.status).toBe(201);
      expect(createJournalEntry).toHaveBeenCalledWith(
        connection, null, expect.any(String),
        expect.stringContaining('Retur pembelian (credit note)'),
        expect.arrayContaining([
          expect.objectContaining({ accountCode: '105', debit: 25000 }),
        ])
      );
    });

    test('returns 201 with write_off_loss handling even when supplier does not accept returns', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[{ id: 1, supplier_id: 1, product_id: 10, initial_quantity: 100, cost_price: 5000, remaining_quantity: 80, batch_number: 'INV-001', expired_date: null, product_category: 'OBAT' }], []])
          .mockResolvedValueOnce([[{ accepts_return: 0 }], []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([[{ total: 500000 }], []])
          .mockResolvedValueOnce([{ insertId: 10 }, []])
          .mockResolvedValueOnce([[{ qty: 0 }], []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([{ insertId: 20 }, []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([{ insertId: 1 }, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/purchases').send({
        invoice_no: 'INV-001',
        handling: 'write_off_loss',
        items: [{ batch_id: 1, qty_returned: 3, condition: 'rusak' }],
      });

      expect(res.status).toBe(201);
      expect(createJournalEntry).toHaveBeenCalledWith(
        connection, null, expect.any(String),
        expect.stringContaining('Retur pembelian (write-off)'),
        expect.arrayContaining([
          expect.objectContaining({ accountCode: '528', debit: 15000 }),
        ])
      );
    });

    test('returns 201 with both obat and non-obat items for reduce_payable', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([
            [{ id: 1, supplier_id: 1, product_id: 10, initial_quantity: 100, cost_price: 5000, remaining_quantity: 80, batch_number: 'INV-001', expired_date: null, product_category: 'OBAT' },
             { id: 2, supplier_id: 1, product_id: 11, initial_quantity: 50, cost_price: 3000, remaining_quantity: 50, batch_number: 'INV-001', expired_date: null, product_category: 'NON_OBAT' }],
            []])
          .mockResolvedValueOnce([[{ accepts_return: 1 }], []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([[{ total: 650000 }], []])
          .mockResolvedValueOnce([{ insertId: 10 }, []])
          .mockResolvedValueOnce([[{ qty: 0 }], []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([{ insertId: 20 }, []])
          .mockResolvedValueOnce([[{ qty: 0 }], []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([{ insertId: 21 }, []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([{ insertId: 1 }, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/purchases').send({
        invoice_no: 'INV-001',
        handling: 'reduce_payable',
        items: [
          { batch_id: 1, qty_returned: 5, condition: 'cacat' },
          { batch_id: 2, qty_returned: 3, condition: 'expired' },
        ],
      });

      expect(res.status).toBe(201);
      expect(createJournalEntry).toHaveBeenCalledWith(
        connection, null, expect.any(String),
        expect.stringContaining('Retur pembelian (kurang hutang)'),
        expect.arrayContaining([
          expect.objectContaining({ accountCode: '103', credit: 25000 }),
          expect.objectContaining({ accountCode: '104', credit: 9000 }),
          expect.objectContaining({ accountCode: '201', debit: 34000 }),
        ])
      );
    });

    test('rolls back and returns 400 on error', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn().mockRejectedValueOnce(new Error('db error')),
        commit: jest.fn(),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/purchases').send({
        invoice_no: 'INV-001',
        handling: 'reduce_payable',
        items: [{ batch_id: 1, qty_returned: 5, condition: 'good' }],
      });

      expect(res.status).toBe(400);
      expect(connection.rollback).toHaveBeenCalled();
      expect(connection.release).toHaveBeenCalled();
    });

    test('returns 400 when item is missing condition field (line 201)', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[{ id: 1, supplier_id: 1, product_id: 10, initial_quantity: 100, cost_price: 5000, remaining_quantity: 80, batch_number: 'INV-001', expired_date: null, product_category: 'OBAT' }], []])
          .mockResolvedValueOnce([[{ accepts_return: 1 }], []])
          .mockResolvedValueOnce([[{ id: 42 }], []]),
        commit: jest.fn(),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/purchases').send({
        invoice_no: 'INV-001',
        handling: 'reduce_payable',
        items: [{ batch_id: 1, qty_returned: 5 }],
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Setiap item wajib memiliki batch_id, qty_returned, dan condition');
      expect(connection.rollback).toHaveBeenCalled();
      expect(connection.release).toHaveBeenCalled();
    });

    test('returns 400 when purchase_id given but purchase not found', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[], []]),
        commit: jest.fn(),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/purchases').send({
        purchase_id: 999,
        handling: 'reduce_payable',
        items: [{ batch_id: 1, qty_returned: 5, condition: 'good' }],
      });

      expect(res.status).toBe(400);
      expect(connection.rollback).toHaveBeenCalled();
    });

    test('generateReturnNo with existing rows increments number', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[{ id: 1, supplier_id: 1, product_id: 10, initial_quantity: 100, cost_price: 5000, remaining_quantity: 80, batch_number: 'INV-001', expired_date: null, product_category: 'OBAT' }], []])
          .mockResolvedValueOnce([[{ accepts_return: 1 }], []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([[{ total: 500000 }], []])
          .mockResolvedValueOnce([{ insertId: 10 }, []])
          .mockResolvedValueOnce([[{ qty: 0 }], []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([{ insertId: 20 }, []])
          .mockResolvedValueOnce([[{ return_no: 'RP-2026-0005' }], []])
          .mockResolvedValueOnce([{ insertId: 1 }, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/purchases').send({
        invoice_no: 'INV-001',
        handling: 'reduce_payable',
        items: [{ batch_id: 1, qty_returned: 5, condition: 'good' }],
      });

      expect(res.status).toBe(201);
      expect(res.body.return_no).toBe('RP-2026-0006');
    });

    test('creates purchase record with zero total when batch total is null (line 36)', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[{ id: 1, supplier_id: 1, product_id: 10, initial_quantity: 100, cost_price: 5000, remaining_quantity: 80, batch_number: 'INV-001', expired_date: null, product_category: 'OBAT' }], []])
          .mockResolvedValueOnce([[{ accepts_return: 1 }], []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([[{ total: null }], []])
          .mockResolvedValueOnce([{ insertId: 10 }, []])
          .mockResolvedValueOnce([[{ qty: 0 }], []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([{ insertId: 20 }, []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([{ insertId: 1 }, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/purchases').send({
        invoice_no: 'INV-001',
        handling: 'reduce_payable',
        items: [{ batch_id: 1, qty_returned: 5, condition: 'good' }],
      });

      expect(res.status).toBe(201);
      expect(connection.commit).toHaveBeenCalled();
    });

    test('returns 400 when qty_returned exceeds returnable qty with proper mocking (lines 210-219)', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[{ id: 1, supplier_id: 1, product_id: 10, initial_quantity: 10, cost_price: 5000, remaining_quantity: 10, batch_number: 'INV-001', expired_date: null, product_category: 'OBAT' }], []])
          .mockResolvedValueOnce([[{ accepts_return: 1 }], []])
          .mockResolvedValueOnce([[{ id: 42 }], []])
          .mockResolvedValueOnce([[{ qty: 0 }], []]),
        commit: jest.fn(),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/purchases').send({
        invoice_no: 'INV-001',
        handling: 'reduce_payable',
        items: [{ batch_id: 1, qty_returned: 20, condition: 'good' }],
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('melebihi sisa retur');
      expect(connection.rollback).toHaveBeenCalled();
    });

    test('returns 201 with credit_note handling for non-obat product (lines 306-307)', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[{ id: 2, supplier_id: 2, product_id: 20, initial_quantity: 200, cost_price: 2000, remaining_quantity: 150, batch_number: 'INV-002', expired_date: null, product_category: 'NON_OBAT' }], []])
          .mockResolvedValueOnce([[{ accepts_return: 1 }], []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([[{ total: 400000 }], []])
          .mockResolvedValueOnce([{ insertId: 11 }, []])
          .mockResolvedValueOnce([[{ qty: 0 }], []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([{ insertId: 21 }, []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([{ insertId: 2 }, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/purchases').send({
        invoice_no: 'INV-002',
        handling: 'credit_note',
        items: [{ batch_id: 2, qty_returned: 5, condition: 'expired' }],
      });

      expect(res.status).toBe(201);
      expect(createJournalEntry).toHaveBeenCalledWith(
        connection, null, expect.any(String),
        expect.stringContaining('Retur pembelian (credit note)'),
        expect.arrayContaining([
          expect.objectContaining({ accountCode: '104', credit: 10000 }),
          expect.objectContaining({ accountCode: '105', debit: 10000 }),
        ])
      );
    });

    test('returns 201 with write_off_loss handling for non-obat product (lines 312-313)', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[{ id: 3, supplier_id: 3, product_id: 30, initial_quantity: 100, cost_price: 5000, remaining_quantity: 80, batch_number: 'INV-003', expired_date: null, product_category: 'NON_OBAT' }], []])
          .mockResolvedValueOnce([[{ accepts_return: 0 }], []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([[{ total: 500000 }], []])
          .mockResolvedValueOnce([{ insertId: 12 }, []])
          .mockResolvedValueOnce([[{ qty: 0 }], []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([{ insertId: 22 }, []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([{ insertId: 3 }, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/purchases').send({
        invoice_no: 'INV-003',
        handling: 'write_off_loss',
        items: [{ batch_id: 3, qty_returned: 3, condition: 'rusak' }],
      });

      expect(res.status).toBe(201);
      expect(createJournalEntry).toHaveBeenCalledWith(
        connection, null, expect.any(String),
        expect.stringContaining('Retur pembelian (write-off)'),
        expect.arrayContaining([
          expect.objectContaining({ accountCode: '104', credit: 15000 }),
          expect.objectContaining({ accountCode: '528', debit: 15000 }),
        ])
      );
    });
  });

  describe('GET /api/returns/purchases', () => {
    test('returns 200 with data array', async () => {
      const rows = [
        { id: 1, return_no: 'RP-2026-0001', supplier_name: 'Supplier A', invoice_no: 'INV-001' },
        { id: 2, return_no: 'RP-2026-0002', supplier_name: 'Supplier B', invoice_no: 'INV-002' },
      ];
      const pool = { query: jest.fn().mockResolvedValueOnce([rows, []]) };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/returns/purchases');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(rows);
    });

    test('returns 200 with empty array', async () => {
      const pool = { query: jest.fn().mockResolvedValueOnce([[], []]) };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/returns/purchases');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    test('returns 500 on error', async () => {
      const pool = { query: jest.fn().mockRejectedValueOnce(new Error('db error')) };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/returns/purchases');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/returns/purchases/:id', () => {
    test('returns 200 with return detail and items', async () => {
      const retRow = { id: 1, return_no: 'RP-2026-0001', supplier_name: 'Supplier A', invoice_no: 'INV-001' };
      const items = [
        { id: 1, return_id: 1, product_name: 'Product A', qty_returned: 5 },
      ];
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[retRow], []])
          .mockResolvedValueOnce([items, []]),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/returns/purchases/1');

      expect(res.status).toBe(200);
      expect(res.body.return_no).toBe('RP-2026-0001');
      expect(res.body.items).toEqual(items);
    });

    test('returns 404 when not found', async () => {
      const pool = { query: jest.fn().mockResolvedValueOnce([[], []]) };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/returns/purchases/999');

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Return not found');
    });

    test('returns 500 on error', async () => {
      const pool = { query: jest.fn().mockRejectedValueOnce(new Error('db error')) };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/returns/purchases/1');

      expect(res.status).toBe(500);
    });
  });
});

describe('createJournalEntry', () => {
  test('inserts journal items when account is found', async () => {
    const { createJournalEntry } = jest.requireActual('../utils/journal');
    const mockConnection = {
      query: jest.fn()
        .mockResolvedValueOnce([{ insertId: 5 }, []])
        .mockResolvedValueOnce([[{ id: 1 }], []])
        .mockResolvedValueOnce([{}, []]),
    };

    const result = await createJournalEntry(
      mockConnection, 1, '2026-06-06', 'Test entry',
      [{ accountCode: '101', debit: 1000, credit: 0 }]
    );
    expect(result).toBe(5);
  });
});

describe('sale returns', () => {
  beforeEach(() => {
    createJournalEntry.mockReset();
  });

  describe('GET /api/returns/sales/lookup', () => {
    test('returns 400 when sale_id is missing', async () => {
      const pool = { query: jest.fn() };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/returns/sales/lookup');

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('sale_id required');
    });

    test('returns 404 when sale not found or not completed', async () => {
      const pool = { query: jest.fn().mockResolvedValueOnce([[], []]) };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/returns/sales/lookup?sale_id=999');

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Transaksi tidak ditemukan atau belum lunas');
    });

    test('returns 200 with sale and enriched items', async () => {
      const sale = { id: 1, transaction_date: '2026-06-01', total_amount: 50000, payment_method: 'cash' };
      const items = [
        { sale_item_id: 1, product_id: 10, quantity: 5, price: 10000, product_name: 'Product A' },
        { sale_item_id: 2, product_id: 11, quantity: 3, price: 15000, product_name: 'Product B' },
      ];
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[sale], []])
          .mockResolvedValueOnce([items, []])
          .mockResolvedValueOnce([[{ qty: 2 }], []])
          .mockResolvedValueOnce([[{ qty: 0 }], []]),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/returns/sales/lookup?sale_id=1');

      expect(res.status).toBe(200);
      expect(res.body.sale.id).toBe(1);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[0].qty_already_returned).toBe(2);
      expect(res.body.items[0].qty_returnable).toBe(3);
      expect(res.body.items[1].qty_already_returned).toBe(0);
      expect(res.body.items[1].qty_returnable).toBe(3);
    });

    test('returns 500 on error', async () => {
      const pool = { query: jest.fn().mockRejectedValueOnce(new Error('db error')) };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/returns/sales/lookup?sale_id=1');

      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/returns/sales', () => {
    test('returns 400 when required fields are missing', async () => {
      const pool = { getConnection: jest.fn() };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/sales').send({
        sale_id: 1,
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('sale_id, refund_method, dan items wajib diisi');
    });

    test('returns 400 when items is empty array', async () => {
      const pool = { getConnection: jest.fn() };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/sales').send({
        sale_id: 1,
        refund_method: 'cash',
        items: [],
      });

      expect(res.status).toBe(400);
    });

    test('returns 400 when refund_method is invalid', async () => {
      const pool = { getConnection: jest.fn() };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/sales').send({
        sale_id: 1,
        refund_method: 'invalid',
        items: [{ sale_item_id: 1, qty_returned: 1 }],
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('refund_method tidak valid');
    });

    test('returns 400 when sale transaction not found', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[], []]),
        commit: jest.fn(),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/sales').send({
        sale_id: 999,
        refund_method: 'cash',
        items: [{ sale_item_id: 1, qty_returned: 1 }],
      });

      expect(res.status).toBe(400);
      expect(connection.rollback).toHaveBeenCalled();
    });

    test('returns 400 when sale item has missing fields', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[{ id: 1, payment_status: 'completed' }], []]),
        commit: jest.fn(),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/sales').send({
        sale_id: 1,
        refund_method: 'cash',
        items: [{ sale_item_id: 1 }],
      });

      expect(res.status).toBe(400);
      expect(connection.rollback).toHaveBeenCalled();
    });

    test('returns 400 when qty_returned <= 0', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[{ id: 1, payment_status: 'completed' }], []]),
        commit: jest.fn(),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/sales').send({
        sale_id: 1,
        refund_method: 'cash',
        items: [{ sale_item_id: 1, qty_returned: 0 }],
      });

      expect(res.status).toBe(400);
      expect(connection.rollback).toHaveBeenCalled();
    });

    test('returns 400 when qty_returned is negative (line 473)', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[{ id: 7, payment_status: 'completed' }], []]),
        commit: jest.fn(),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/sales').send({
        sale_id: 7,
        refund_method: 'cash',
        items: [{ sale_item_id: 1, qty_returned: -1 }],
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('qty_returned harus > 0');
      expect(connection.rollback).toHaveBeenCalled();
    });

    test('returns 400 when sale item not found', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[{ id: 1, payment_status: 'completed' }], []])
          .mockResolvedValueOnce([[], []]),
        commit: jest.fn(),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/sales').send({
        sale_id: 1,
        refund_method: 'cash',
        items: [{ sale_item_id: 999, qty_returned: 1 }],
      });

      expect(res.status).toBe(400);
      expect(connection.rollback).toHaveBeenCalled();
    });

    test('returns 400 when sale item belongs to a different transaction', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[{ id: 1, payment_status: 'completed' }], []])
          .mockResolvedValueOnce([[{ id: 1, transaction_id: 2, product_id: 10, quantity: 5, price: 10000, cost_price: 5000, product_category: 'OBAT', product_name: 'Product A' }], []]),
        commit: jest.fn(),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/sales').send({
        sale_id: 1,
        refund_method: 'cash',
        items: [{ sale_item_id: 1, qty_returned: 1 }],
      });

      expect(res.status).toBe(400);
      expect(connection.rollback).toHaveBeenCalled();
    });

    test('returns 400 when qty_returned exceeds returnable qty', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[{ id: 1, payment_status: 'completed' }], []])
          .mockResolvedValueOnce([[{ id: 1, transaction_id: 1, product_id: 10, quantity: 5, price: 10000, cost_price: 5000, product_category: 'OBAT', product_name: 'Product A' }], []])
          .mockResolvedValueOnce([[{ qty: 4 }], []]),
        commit: jest.fn(),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/sales').send({
        sale_id: 1,
        refund_method: 'cash',
        items: [{ sale_item_id: 1, qty_returned: 2 }],
      });

      expect(res.status).toBe(400);
      expect(connection.rollback).toHaveBeenCalled();
    });

    test('returns 400 when no batch found for the product', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[{ id: 1, payment_status: 'completed' }], []])
          .mockResolvedValueOnce([[{ id: 1, transaction_id: 1, product_id: 10, quantity: 5, price: 10000, cost_price: 5000, product_category: 'OBAT', product_name: 'Product A' }], []])
          .mockResolvedValueOnce([[{ qty: 0 }], []])
          .mockResolvedValueOnce([[], []]),
        commit: jest.fn(),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/sales').send({
        sale_id: 1,
        refund_method: 'cash',
        items: [{ sale_item_id: 1, qty_returned: 1 }],
      });

      expect(res.status).toBe(400);
      expect(connection.rollback).toHaveBeenCalled();
    });

    test('returns 201 with cash refund for OBAT product and fully_returned', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[{ id: 1, payment_status: 'completed' }], []])
          .mockResolvedValueOnce([[{ id: 1, transaction_id: 1, product_id: 10, quantity: 5, price: 10000, cost_price: 5000, product_category: 'OBAT', product_name: 'Product A' }], []])
          .mockResolvedValueOnce([[{ qty: 0 }], []])
          .mockResolvedValueOnce([[{ id: 5 }], []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([{ insertId: 1 }, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([[{ id: 1, quantity: 5 }], []])
          .mockResolvedValueOnce([[{ total: 5 }], []])
          .mockResolvedValueOnce([{}, []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app, createAuditTrail } = buildApp({ pool });

      const res = await request(app).post('/api/returns/sales').send({
        sale_id: 1,
        refund_method: 'cash',
        reason: 'cacat',
        items: [{ sale_item_id: 1, qty_returned: 5 }],
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.return_no).toContain('RJ-');
      expect(res.body.total_refund).toBe(50000);
      expect(createJournalEntry).toHaveBeenCalledWith(
        connection, 1, expect.any(String),
        expect.stringContaining('Retur penjualan'),
        expect.arrayContaining([
          expect.objectContaining({ accountCode: '403', debit: 50000 }),
          expect.objectContaining({ accountCode: '103', debit: 25000 }),
          expect.objectContaining({ accountCode: '501', credit: 25000 }),
          expect.objectContaining({ accountCode: '101', credit: 50000 }),
        ])
      );
      expect(connection.commit).toHaveBeenCalled();
      expect(connection.release).toHaveBeenCalled();
      expect(createAuditTrail).toHaveBeenCalledWith(expect.objectContaining({
        module: 'Retur Penjualan',
        action: 'create',
      }));
    });

    test('returns 201 with cash refund for NON_OBAT product', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[{ id: 2, payment_status: 'completed' }], []])
          .mockResolvedValueOnce([[{ id: 2, transaction_id: 2, product_id: 11, quantity: 3, price: 15000, cost_price: 7000, product_category: 'NON_OBAT', product_name: 'Product B' }], []])
          .mockResolvedValueOnce([[{ qty: 0 }], []])
          .mockResolvedValueOnce([[{ id: 6 }], []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([{ insertId: 2 }, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([[{ id: 2, quantity: 3 }], []])
          .mockResolvedValueOnce([[{ total: 1 }], []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/sales').send({
        sale_id: 2,
        refund_method: 'cash',
        items: [{ sale_item_id: 2, qty_returned: 1 }],
      });

      expect(res.status).toBe(201);
      expect(createJournalEntry).toHaveBeenCalledWith(
        connection, 2, expect.any(String),
        expect.stringContaining('Retur penjualan'),
        expect.arrayContaining([
          expect.objectContaining({ accountCode: '403', debit: 15000 }),
          expect.objectContaining({ accountCode: '104', debit: 7000 }),
          expect.objectContaining({ accountCode: '502', credit: 7000 }),
          expect.objectContaining({ accountCode: '101', credit: 15000 }),
        ])
      );
    });

    test('returns 201 with credit_note refund method', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[{ id: 3, payment_status: 'completed' }], []])
          .mockResolvedValueOnce([[{ id: 3, transaction_id: 3, product_id: 12, quantity: 2, price: 20000, cost_price: 8000, product_category: 'OBAT', product_name: 'Product C' }], []])
          .mockResolvedValueOnce([[{ qty: 0 }], []])
          .mockResolvedValueOnce([[{ id: 7 }], []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([{ insertId: 3 }, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([[{ id: 3, quantity: 2 }], []])
          .mockResolvedValueOnce([[{ total: 2 }], []])
          .mockResolvedValueOnce([{}, []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/sales').send({
        sale_id: 3,
        refund_method: 'credit_note',
        items: [{ sale_item_id: 3, qty_returned: 2 }],
      });

      expect(res.status).toBe(201);
      expect(createJournalEntry).toHaveBeenCalledWith(
        connection, 3, expect.any(String),
        expect.stringContaining('Retur penjualan'),
        expect.arrayContaining([
          expect.objectContaining({ accountCode: '106', credit: 40000 }),
        ])
      );
    });

    test('not fully returned when some items remain', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[{ id: 4, payment_status: 'completed' }], []])
          .mockResolvedValueOnce([[{ id: 4, transaction_id: 4, product_id: 10, quantity: 5, price: 10000, cost_price: 5000, product_category: 'OBAT', product_name: 'Product A' }], []])
          .mockResolvedValueOnce([[{ qty: 2 }], []])
          .mockResolvedValueOnce([[{ id: 5 }], []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([{ insertId: 4 }, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([[{ id: 4, quantity: 5 }], []])
          .mockResolvedValueOnce([[{ total: 3 }], []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/sales').send({
        sale_id: 4,
        refund_method: 'cash',
        items: [{ sale_item_id: 4, qty_returned: 1 }],
      });

      expect(res.status).toBe(201);
    });

    test('handles null cost_price in sale return (line 496)', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[{ id: 6, payment_status: 'completed' }], []])
          .mockResolvedValueOnce([[{ id: 7, transaction_id: 6, product_id: 10, quantity: 5, price: 10000, cost_price: null, product_category: 'OBAT', product_name: 'Product A' }], []])
          .mockResolvedValueOnce([[{ qty: 0 }], []])
          .mockResolvedValueOnce([[{ id: 5 }], []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([{ insertId: 6 }, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([[{ id: 6, quantity: 5 }], []])
          .mockResolvedValueOnce([[{ total: 1 }], []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/sales').send({
        sale_id: 6,
        refund_method: 'cash',
        items: [{ sale_item_id: 7, qty_returned: 1 }],
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    test('returns 201 with both obat and non-obat items (persediaanCode returns null, line 579)', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([[{ id: 5, payment_status: 'completed' }], []])
          .mockResolvedValueOnce([[{ id: 5, transaction_id: 5, product_id: 10, quantity: 5, price: 10000, cost_price: 5000, product_category: 'OBAT', product_name: 'Product A' }], []])
          .mockResolvedValueOnce([[{ qty: 0 }], []])
          .mockResolvedValueOnce([[{ id: 10 }], []])
          .mockResolvedValueOnce([[{ id: 6, transaction_id: 5, product_id: 11, quantity: 3, price: 15000, cost_price: 7000, product_category: 'NON_OBAT', product_name: 'Product B' }], []])
          .mockResolvedValueOnce([[{ qty: 0 }], []])
          .mockResolvedValueOnce([[{ id: 11 }], []])
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([{ insertId: 5 }, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([{}, []])
          .mockResolvedValueOnce([[{ id: 5, quantity: 5 }, { id: 6, quantity: 3 }], []])
          .mockResolvedValueOnce([[{ total: 2 }], []])
          .mockResolvedValueOnce([[{ total: 1 }], []]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/sales').send({
        sale_id: 5,
        refund_method: 'cash',
        items: [
          { sale_item_id: 5, qty_returned: 2 },
          { sale_item_id: 6, qty_returned: 1 },
        ],
      });

      expect(res.status).toBe(201);
      expect(res.body.total_refund).toBe(35000);
      expect(createJournalEntry).toHaveBeenCalledWith(
        connection, 5, expect.any(String),
        expect.stringContaining('Retur penjualan'),
        expect.arrayContaining([
          expect.objectContaining({ accountCode: '403', debit: 35000 }),
          expect.objectContaining({ accountCode: '501', credit: 10000 }),
          expect.objectContaining({ accountCode: '103', debit: 10000 }),
          expect.objectContaining({ accountCode: '502', credit: 7000 }),
          expect.objectContaining({ accountCode: '104', debit: 7000 }),
          expect.objectContaining({ accountCode: '101', credit: 35000 }),
        ])
      );
    });

    test('rolls back and returns 400 on error', async () => {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn().mockRejectedValueOnce(new Error('db error')),
        commit: jest.fn(),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };
      const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
      const { app } = buildApp({ pool });

      const res = await request(app).post('/api/returns/sales').send({
        sale_id: 1,
        refund_method: 'cash',
        items: [{ sale_item_id: 1, qty_returned: 1 }],
      });

      expect(res.status).toBe(400);
      expect(connection.rollback).toHaveBeenCalled();
      expect(connection.release).toHaveBeenCalled();
    });


  });

  describe('GET /api/returns/sales', () => {
    test('returns 200 with data array', async () => {
      const rows = [
        { id: 1, return_no: 'RJ-2026-0001', returned_by_name: 'admin' },
      ];
      const pool = { query: jest.fn().mockResolvedValueOnce([rows, []]) };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/returns/sales');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(rows);
    });

    test('returns 200 with empty array', async () => {
      const pool = { query: jest.fn().mockResolvedValueOnce([[], []]) };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/returns/sales');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    test('returns 500 on error', async () => {
      const pool = { query: jest.fn().mockRejectedValueOnce(new Error('db error')) };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/returns/sales');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/returns/sales/:id', () => {
    test('returns 200 with return detail and items', async () => {
      const retRow = { id: 1, return_no: 'RJ-2026-0001', returned_by_name: 'admin' };
      const items = [
        { id: 1, return_id: 1, product_name: 'Product A', qty_returned: 5 },
      ];
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce([[retRow], []])
          .mockResolvedValueOnce([items, []]),
      };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/returns/sales/1');

      expect(res.status).toBe(200);
      expect(res.body.return_no).toBe('RJ-2026-0001');
      expect(res.body.items).toEqual(items);
    });

    test('returns 404 when not found', async () => {
      const pool = { query: jest.fn().mockResolvedValueOnce([[], []]) };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/returns/sales/999');

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Return not found');
    });

    test('returns 500 on error', async () => {
      const pool = { query: jest.fn().mockRejectedValueOnce(new Error('db error')) };
      const { app } = buildApp({ pool });

      const res = await request(app).get('/api/returns/sales/1');

      expect(res.status).toBe(500);
    });
  });
});
