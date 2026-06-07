const express = require('express');
const request = require('supertest');
const { registerAuditTrailRoutes, createAuditTrail } = require('../routes/audit-trails');

function buildApp({ pool, user }) {
  const app = express();
  app.use(express.json());

  const authenticate = (req, _res, next) => {
    req.user = user || { id: 1, role: 'superadmin' };
    next();
  };
  const checkPermission = () => (_req, _res, next) => next();

  registerAuditTrailRoutes(app, pool, authenticate, checkPermission);
  return app;
}

describe('audit-trails module', () => {
  describe('GET /api/audit-trails', () => {
    test('returns paginated list', async () => {
      const rows = [{ id: 1, module: 'Products', action: 'create', created_at: '2025-01-01' }];
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce([rows, []])
          .mockResolvedValueOnce([[{ total: 1 }], []]),
      };
      const app = buildApp({ pool });

      const res = await request(app).get('/api/audit-trails?page=1&limit=10');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(rows);
      expect(res.body.total).toBe(1);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(10);
      expect(res.body.total_pages).toBe(1);
    });

    test('returns empty result when no records', async () => {
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce([[], []])
          .mockResolvedValueOnce([[{ total: 0 }], []]),
      };
      const app = buildApp({ pool });

      const res = await request(app).get('/api/audit-trails');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.total).toBe(0);
    });

    test('applies module, user_id, start_date, end_date filters', async () => {
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce([[{ id: 1 }], []])
          .mockResolvedValueOnce([[{ total: 1 }], []]),
      };
      const app = buildApp({ pool });

      await request(app).get(
        '/api/audit-trails?module=Auth&user_id=5&start_date=2025-01-01&end_date=2025-12-31'
      );

      const dataQueryParams = pool.query.mock.calls[0][1];
      expect(dataQueryParams).toContain('Auth');
      expect(dataQueryParams).toContain('5');
      expect(dataQueryParams).toContain('2025-01-01');
      expect(dataQueryParams).toContain('2025-12-31');

      const countQueryParams = pool.query.mock.calls[1][1];
      expect(countQueryParams).toContain('Auth');
      expect(countQueryParams).toContain('5');
    });

    test('returns 500 on database error', async () => {
      const pool = {
        query: jest.fn().mockRejectedValue(new Error('db error')),
      };
      const app = buildApp({ pool });

      const res = await request(app).get('/api/audit-trails');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to fetch audit trails');
    });
  });

  describe('GET /api/audit-trails/:id', () => {
    test('returns a single record', async () => {
      const record = { id: 1, module: 'Products', action: 'create' };
      const pool = {
        query: jest.fn().mockResolvedValue([[record], []]),
      };
      const app = buildApp({ pool });

      const res = await request(app).get('/api/audit-trails/1');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(record);
    });

    test('returns 404 when not found', async () => {
      const pool = {
        query: jest.fn().mockResolvedValue([[], []]),
      };
      const app = buildApp({ pool });

      const res = await request(app).get('/api/audit-trails/999');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Audit trail not found');
    });

    test('returns 500 on database error', async () => {
      const pool = {
        query: jest.fn().mockRejectedValue(new Error('db error')),
      };
      const app = buildApp({ pool });

      const res = await request(app).get('/api/audit-trails/1');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to fetch audit trail');
    });
  });

  describe('createAuditTrail()', () => {
    test('success with all fields', async () => {
      const pool = { query: jest.fn().mockResolvedValue([{ insertId: 1 }, []]) };
      const data = {
        user_id: 1,
        username: 'admin',
        role: 'superadmin',
        module: 'Products',
        action: 'create',
        description: 'Created product X',
        ip_address: '127.0.0.1',
        user_agent: 'test-agent',
      };

      await createAuditTrail(pool, data);

      expect(pool.query).toHaveBeenCalledWith(
        'INSERT INTO audit_trails (user_id, username, role, module, action, description, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [1, 'admin', 'superadmin', 'Products', 'create', 'Created product X', '127.0.0.1', 'test-agent']
      );
    });

    test('success with minimal fields', async () => {
      const pool = { query: jest.fn().mockResolvedValue([{ insertId: 1 }, []]) };
      const data = {
        user_id: 1,
        module: 'Products',
        action: 'create',
      };

      await createAuditTrail(pool, data);

      expect(pool.query).toHaveBeenCalled();
      const params = pool.query.mock.calls[0][1];
      expect(params[0]).toBe(1);
      expect(params[3]).toBe('Products');
      expect(params[4]).toBe('create');
    });

    test('handles DB error gracefully (does not throw)', async () => {
      const pool = { query: jest.fn().mockRejectedValue(new Error('db error')) };
      const data = {
        user_id: 1,
        module: 'Products',
        action: 'create',
      };

      await expect(createAuditTrail(pool, data)).resolves.toBeUndefined();
    });
  });
});
