const express = require('express');
const request = require('supertest');

const registerReportRoutes = require('../routes/reports');
jest.mock('../utils/journal');
const { createJournalEntry } = require('../utils/journal');

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
        .mockResolvedValueOnce([[{ total_revenue: 2000 }], []])
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
        .mockResolvedValueOnce([[{ total_revenue: null }], []])
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

  test('GET /api/financial/profit-loss-accounting missing params returns 400', async () => {
    const pool = { getConnection: jest.fn() };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/financial/profit-loss-accounting');
    expect(res.status).toBe(400);
  });

  test('GET /api/financial/profit-loss-accounting returns report', async () => {
    const connection = {
      query: jest.fn().mockResolvedValueOnce([[
        { code: '411', name: 'Penjualan', type: 'pendapatan', normal_balance: 'kredit', total_debit: 0, total_credit: 1000 },
        { code: '511', name: 'HPP', type: 'beban', normal_balance: 'debit', total_debit: 200, total_credit: 0 },
      ], []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/financial/profit-loss-accounting?month=1&year=2026');
    expect(res.status).toBe(200);
    expect(res.body.accounts.length).toBe(2);
    expect(res.body.period.month).toBe('1');
  });

  test('GET /api/financial/profit-loss-accounting error returns 500', async () => {
    const pool = { getConnection: jest.fn().mockRejectedValueOnce(new Error('db')) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/financial/profit-loss-accounting?month=1&year=2026');
    expect(res.status).toBe(500);
  });

  test('GET /api/reports/balance-accounting returns balance sheet with profit account', async () => {
    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[
          { id: 1, code: '111', name: 'Kas', type: 'aset', normal_balance: 'debit', total_debit: 1000, total_credit: 0 },
          { id: 2, code: '311', name: 'Laba Tahun Berjalan', type: 'modal', normal_balance: 'kredit', total_debit: 0, total_credit: 500 },
        ], []])
        .mockResolvedValueOnce([[
          { id: 3, code: '411', name: 'Penjualan', type: 'pendapatan', normal_balance: 'kredit', total_debit: 0, total_credit: 2000 },
          { id: 4, code: '511', name: 'HPP', type: 'beban', normal_balance: 'debit', total_debit: 1200, total_credit: 0 },
        ], []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/reports/balance-accounting?month=1&year=2026');
    expect(res.status).toBe(200);
    const profitAcc = res.body.accounts.find(a => a.code === '311');
    expect(profitAcc).toBeDefined();
    expect(Number(profitAcc.total_credit)).toBe(500 + 800);
  });

  test('GET /api/reports/balance-accounting creates profit account when missing', async () => {
    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[
          { id: 1, code: '111', name: 'Kas', type: 'aset', normal_balance: 'debit', total_debit: 1000, total_credit: 0 },
          { id: 3, code: '411', name: 'Penjualan', type: 'pendapatan', normal_balance: 'kredit', total_debit: 0, total_credit: 500 },
        ], []])
        .mockResolvedValueOnce([[
          { id: 3, code: '411', name: 'Penjualan', type: 'pendapatan', normal_balance: 'kredit', total_debit: 0, total_credit: 500 },
        ], []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/reports/balance-accounting?month=1&year=2026');
    expect(res.status).toBe(200);
    const profitAcc = res.body.accounts.find(a => a.code === '311');
    expect(profitAcc).toBeDefined();
    expect(profitAcc.id).toBe(999);
    expect(Number(profitAcc.total_credit)).toBe(500);
  });

  test('GET /api/reports/balance-accounting with debit profit account and positive net profit (lines 194-195)', async () => {
    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[
          { id: 1, code: '111', name: 'Kas', type: 'aset', normal_balance: 'debit', total_debit: 1000, total_credit: 0 },
          { id: 2, code: '311', name: 'Laba Tahun Berjalan', type: 'modal', normal_balance: 'debit', total_debit: 100, total_credit: 50 },
        ], []])
        .mockResolvedValueOnce([[
          { id: 3, code: '411', name: 'Penjualan', type: 'pendapatan', normal_balance: 'kredit', total_debit: 0, total_credit: 2000 },
          { id: 4, code: '511', name: 'HPP', type: 'beban', normal_balance: 'debit', total_debit: 600, total_credit: 0 },
        ], []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/reports/balance-accounting?month=1&year=2026');
    expect(res.status).toBe(200);
    const profitAcc = res.body.accounts.find(a => a.code === '311');
    expect(profitAcc).toBeDefined();
    expect(Number(profitAcc.total_credit)).toBe(1450);
  });

  test('GET /api/reports/balance-accounting with debit profit account and negative net profit (lines 194,196-197)', async () => {
    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[
          { id: 1, code: '111', name: 'Kas', type: 'aset', normal_balance: 'debit', total_debit: 1000, total_credit: 0 },
          { id: 2, code: '311', name: 'Laba Tahun Berjalan', type: 'modal', normal_balance: 'debit', total_debit: 100, total_credit: 50 },
        ], []])
        .mockResolvedValueOnce([[
          { id: 3, code: '411', name: 'Penjualan', type: 'pendapatan', normal_balance: 'kredit', total_debit: 0, total_credit: 500 },
          { id: 4, code: '511', name: 'HPP', type: 'beban', normal_balance: 'debit', total_debit: 1000, total_credit: 0 },
        ], []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/reports/balance-accounting?month=1&year=2026');
    expect(res.status).toBe(200);
    const profitAcc = res.body.accounts.find(a => a.code === '311');
    expect(profitAcc).toBeDefined();
    expect(Number(profitAcc.total_debit)).toBe(600);
  });

  test('GET /api/reports/balance-accounting with credit profit account and negative net profit (line 203)', async () => {
    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[
          { id: 1, code: '111', name: 'Kas', type: 'aset', normal_balance: 'debit', total_debit: 1000, total_credit: 0 },
          { id: 2, code: '311', name: 'Laba Tahun Berjalan', type: 'modal', normal_balance: 'kredit', total_debit: 0, total_credit: 500 },
        ], []])
        .mockResolvedValueOnce([[
          { id: 3, code: '411', name: 'Penjualan', type: 'pendapatan', normal_balance: 'kredit', total_debit: 0, total_credit: 200 },
          { id: 4, code: '511', name: 'HPP', type: 'beban', normal_balance: 'debit', total_debit: 600, total_credit: 0 },
        ], []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/reports/balance-accounting?month=1&year=2026');
    expect(res.status).toBe(200);
    const profitAcc = res.body.accounts.find(a => a.code === '311');
    expect(profitAcc).toBeDefined();
    expect(Number(profitAcc.total_debit)).toBe(400);
  });

  test('GET /api/reports/balance-accounting error returns 500', async () => {
    const pool = { getConnection: jest.fn().mockRejectedValueOnce(new Error('db')) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/reports/balance-accounting?month=1&year=2026');
    expect(res.status).toBe(500);
  });

  test('GET /api/accounting/general-ledger returns ledger data', async () => {
    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[
          { id: 1, date: '2026-01-01', description: 'Test', code: '111', name: 'Kas', type: 'aset', normal_balance: 'debit', debit: 100, credit: 0 },
        ], []])
        .mockResolvedValueOnce([[
          { id: 1, code: '111', name: 'Kas', type: 'aset', normal_balance: 'debit' },
        ], []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/accounting/general-ledger?month=1&year=2026');
    expect(res.status).toBe(200);
    expect(res.body.ledger.length).toBe(1);
    expect(res.body.accounts.length).toBe(1);
  });

  test('GET /api/accounting/general-ledger with accountId filter', async () => {
    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[
          { id: 1, date: '2026-01-01', description: 'Test', code: '111', name: 'Kas', type: 'aset', normal_balance: 'debit', debit: 100, credit: 0 },
        ], []])
        .mockResolvedValueOnce([[
          { id: 1, code: '111', name: 'Kas', type: 'aset', normal_balance: 'debit' },
        ], []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/accounting/general-ledger?month=1&year=2026&accountId=1');
    expect(res.status).toBe(200);
    expect(res.body.ledger.length).toBe(1);
  });

  test('GET /api/accounting/general-ledger error returns 500', async () => {
    const pool = { getConnection: jest.fn().mockRejectedValueOnce(new Error('db')) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/accounting/general-ledger?month=1&year=2026');
    expect(res.status).toBe(500);
  });

  test('GET /api/accounting/journal-entries returns entries without date filter', async () => {
    const connection = {
      query: jest.fn().mockResolvedValueOnce([[
        { entry_id: 1, date: '2026-01-01', description: 'JE 1', created_at: '2026-01-01T00:00:00.000Z', item_id: 1, debit: 100, credit: 0, account_code: '111', account_name: 'Kas', account_type: 'aset' },
        { entry_id: 1, date: '2026-01-01', description: 'JE 1', created_at: '2026-01-01T00:00:00.000Z', item_id: 2, debit: 0, credit: 100, account_code: '411', account_name: 'Penjualan', account_type: 'pendapatan' },
      ], []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/accounting/journal-entries');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].items.length).toBe(2);
  });

  test('GET /api/accounting/journal-entries with date filter', async () => {
    const connection = {
      query: jest.fn().mockResolvedValueOnce([[
        { entry_id: 1, date: '2026-01-15', description: 'JE 1', created_at: '2026-01-15T00:00:00.000Z', item_id: 1, debit: 100, credit: 0, account_code: '111', account_name: 'Kas', account_type: 'aset' },
      ], []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/accounting/journal-entries?startDate=2026-01-01&endDate=2026-01-31');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  test('GET /api/accounting/journal-entries returns empty array when no entries', async () => {
    const connection = {
      query: jest.fn().mockResolvedValueOnce([[], []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/accounting/journal-entries');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test('GET /api/accounting/journal-entries error returns 500', async () => {
    const pool = { getConnection: jest.fn().mockRejectedValueOnce(new Error('db')) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/accounting/journal-entries');
    expect(res.status).toBe(500);
  });

  test('POST /api/accounting/journal-entries creates entry', async () => {
    const connection = {
      beginTransaction: jest.fn().mockResolvedValue(),
      commit: jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue(),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app)
      .post('/api/accounting/journal-entries')
      .send({ date: '2026-01-01', description: 'Test entry', items: [{ accountCode: '111', debit: 100, credit: 0 }, { accountCode: '411', debit: 0, credit: 100 }] });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(createJournalEntry).toHaveBeenCalled();
  });

  test('POST /api/accounting/journal-entries missing fields returns 400', async () => {
    const pool = { getConnection: jest.fn() };
    const app = buildApp({ pool });

    const res = await request(app)
      .post('/api/accounting/journal-entries')
      .send({ date: '2026-01-01' });
    expect(res.status).toBe(400);
  });

  test('POST /api/accounting/journal-entries unbalanced returns 400', async () => {
    const pool = { getConnection: jest.fn() };
    const app = buildApp({ pool });

    const res = await request(app)
      .post('/api/accounting/journal-entries')
      .send({ date: '2026-01-01', description: 'Test', items: [{ accountCode: '111', debit: 100, credit: 0 }, { accountCode: '411', debit: 0, credit: 50 }] });
    expect(res.status).toBe(400);
  });

  test('POST /api/accounting/journal-entries error returns 500', async () => {
    createJournalEntry.mockRejectedValueOnce(new Error('db'));
    const connection = {
      beginTransaction: jest.fn().mockResolvedValue(),
      commit: jest.fn(),
      rollback: jest.fn().mockResolvedValue(),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app)
      .post('/api/accounting/journal-entries')
      .send({ date: '2026-01-01', description: 'Test entry', items: [{ accountCode: '111', debit: 100, credit: 0 }, { accountCode: '411', debit: 0, credit: 100 }] });
    expect(res.status).toBe(500);
    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
  });

  test('GET /api/reports/balance-accounting defaults to current month/year when missing (lines 137-138)', async () => {
    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[], []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/reports/balance-accounting');

    expect(res.status).toBe(200);
    expect(res.body.period.endDate).toBeDefined();
  });

  test('GET /api/reports/balance-accounting handles account types beyond pendapatan/beban in forEach (line 182)', async () => {
    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[
          { id: 1, code: '111', name: 'Kas', type: 'aset', normal_balance: 'debit', total_debit: 1000, total_credit: 0 },
        ], []])
        .mockResolvedValueOnce([[
          { id: 3, code: '411', name: 'Penjualan', type: 'pendapatan', normal_balance: 'kredit', total_debit: 0, total_credit: 500 },
          { id: 5, code: '999', name: 'Other', type: 'other', normal_balance: 'debit', total_debit: 100, total_credit: 0 },
        ], []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/reports/balance-accounting?month=1&year=2026');

    expect(res.status).toBe(200);
    const profitAcc = res.body.accounts.find(a => a.code === '311');
    expect(profitAcc).toBeDefined();
  });

  test('GET /api/accounting/general-ledger defaults to current month when missing (lines 239-240)', async () => {
    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[], []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/accounting/general-ledger');

    expect(res.status).toBe(200);
  });

  test('GET /api/reports/balance-accounting creates profit account with negative net profit (lines 214-216)', async () => {
    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[
          { id: 1, code: '111', name: 'Kas', type: 'aset', normal_balance: 'debit', total_debit: 1000, total_credit: 0 },
        ], []])
        .mockResolvedValueOnce([[
          { id: 3, code: '411', name: 'Penjualan', type: 'pendapatan', normal_balance: 'kredit', total_debit: 0, total_credit: 200 },
          { id: 4, code: '511', name: 'HPP', type: 'beban', normal_balance: 'debit', total_debit: 600, total_credit: 0 },
        ], []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/reports/balance-accounting?month=1&year=2026');

    expect(res.status).toBe(200);
    const profitAcc = res.body.accounts.find(a => a.code === '311');
    expect(profitAcc).toBeDefined();
    expect(profitAcc.id).toBe(999);
    expect(Number(profitAcc.total_debit)).toBe(400);
    expect(Number(profitAcc.total_credit)).toBe(0);
  });

  test('GET /api/accounting/journal-entries handles entry with null item_id (line 469)', async () => {
    const connection = {
      query: jest.fn().mockResolvedValueOnce([[
        { entry_id: 1, date: '2026-01-01', description: 'Empty JE', created_at: '2026-01-01T00:00:00.000Z', item_id: null, debit: null, credit: null, account_code: null, account_name: null, account_type: null },
      ], []]),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
    const app = buildApp({ pool });

    const res = await request(app).get('/api/accounting/journal-entries');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].items).toEqual([]);
  });
});
