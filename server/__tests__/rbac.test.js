const request = require('supertest');
const jwt = require('jsonwebtoken');

async function loadAppWithMockedDb() {
  process.env.JWT_SECRET = 'test_jwt_secret';

  jest.resetModules();

  const mockConnection = {
    query: jest.fn(),
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    release: jest.fn(),
  };

  const mockPool = {
    query: jest.fn(),
    getConnection: jest.fn().mockResolvedValue(mockConnection),
  };

  jest.doMock('../db', () => ({
    pool: mockPool,
    initDB: jest.fn().mockResolvedValue(undefined),
  }));

  const { app, authenticate, checkPermission } = require('../index');

  const superadminToken = jwt.sign(
    { id: 1, username: 'admin', role: 'superadmin', email: 'admin@example.com' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const userToken = jwt.sign(
    { id: 2, username: 'u', role: 'user', email: 'u@u.com' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  return { app, mockPool, mockConnection, superadminToken, userToken, authenticate, checkPermission };
}

describe('authenticate middleware', () => {
  test('returns 401 when no token provided', async () => {
    const { app } = await loadAppWithMockedDb();
    const res = await request(app).get('/api/rbac/modules');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Unauthorized');
  });

  test('returns 401 when invalid token provided', async () => {
    const { app } = await loadAppWithMockedDb();
    const res = await request(app).get('/api/rbac/modules').set('Authorization', 'Bearer invalidtoken');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Unauthorized');
  });

  test('passes with valid token', async () => {
    const { app, superadminToken } = await loadAppWithMockedDb();
    const res = await request(app).get('/api/rbac/modules').set('Authorization', `Bearer ${superadminToken}`);
    expect(res.status).toBe(200);
  });
});

describe('requireSuperadmin middleware', () => {
  test('blocks non-superadmin from creating roles', async () => {
    const { app, userToken } = await loadAppWithMockedDb();
    const res = await request(app).post('/api/rbac/roles').set('Authorization', `Bearer ${userToken}`).send({ name: 'test' });
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Forbidden');
  });

  test('blocks non-superadmin from deleting roles', async () => {
    const { app, userToken } = await loadAppWithMockedDb();
    const res = await request(app).delete('/api/rbac/roles/1').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Forbidden');
  });

  test('blocks non-superadmin from updating permissions', async () => {
    const { app, userToken } = await loadAppWithMockedDb();
    const res = await request(app).put('/api/rbac/permissions').set('Authorization', `Bearer ${userToken}`).send({ roleId: 1, permissions: [] });
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Forbidden');
  });
});

describe('checkPermission middleware', () => {
  describe('superadmin bypass for critical modules', () => {
    test('Role & Permission module bypasses check for superadmin', async () => {
      const { app, superadminToken, authenticate, checkPermission } = await loadAppWithMockedDb();
      app.get('/__test_role_perm', authenticate, checkPermission('Role & Permission', 'show'), (req, res) => {
        res.json({ ok: true });
      });

      const res = await request(app).get('/__test_role_perm').set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(200);
    });

    test('Transaction Setting module bypasses check for superadmin', async () => {
      const { app, superadminToken, authenticate, checkPermission } = await loadAppWithMockedDb();
      app.get('/__test_trans_setting', authenticate, checkPermission('Transaction Setting', 'show'), (req, res) => {
        res.json({ ok: true });
      });

      const res = await request(app).get('/__test_trans_setting').set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(200);
    });
  });

  describe('role-not-found behavior', () => {
    test('superadmin passes when role not found in roles table (fallback)', async () => {
      const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
      mockPool.query.mockResolvedValueOnce([[], []]);
      mockPool.query.mockResolvedValueOnce([[{ id: 1, name: 'Paracetamol', stock: 10, unit: 'pcs' }], []]);

      const res = await request(app).get('/api/forecast/products').set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(200);
    });

    test('non-superadmin blocked when role not found in roles table', async () => {
      const { app, mockPool, userToken } = await loadAppWithMockedDb();
      mockPool.query.mockResolvedValueOnce([[], []]);

      const res = await request(app).get('/api/forecast/products').set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('permission record behavior', () => {
    test('allows when permission found and allowed', async () => {
      const { app, mockPool, userToken } = await loadAppWithMockedDb();
      mockPool.query
        .mockResolvedValueOnce([[{ id: 2 }], []])
        .mockResolvedValueOnce([[{ allowed: 1 }], []])
        .mockResolvedValueOnce([[{ id: 1, name: 'Paracetamol', stock: 10, unit: 'pcs' }], []]);

      const res = await request(app).get('/api/forecast/products').set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
    });

    test('blocks when permission found but not allowed', async () => {
      const { app, mockPool, userToken } = await loadAppWithMockedDb();
      mockPool.query
        .mockResolvedValueOnce([[{ id: 2 }], []])
        .mockResolvedValueOnce([[{ allowed: 0 }], []]);

      const res = await request(app).get('/api/forecast/products').set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });

    test('superadmin fallback when no permission records exist', async () => {
      const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
      mockPool.query
        .mockResolvedValueOnce([[{ id: 1 }], []])
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1, name: 'Paracetamol', stock: 10, unit: 'pcs' }], []]);

      const res = await request(app).get('/api/forecast/products').set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(200);
    });

    test('non-superadmin blocked when no permission records exist', async () => {
      const { app, mockPool, userToken } = await loadAppWithMockedDb();
      mockPool.query
        .mockResolvedValueOnce([[{ id: 2 }], []])
        .mockResolvedValueOnce([[], []]);

      const res = await request(app).get('/api/forecast/products').set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });
  });

  test('returns 500 on DB error', async () => {
    const { app, mockPool, userToken } = await loadAppWithMockedDb();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockPool.query.mockRejectedValue(new Error('DB fail'));

    const res = await request(app).get('/api/forecast/products').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(500);

    errorSpy.mockRestore();
  });
});

describe('RBAC API endpoints', () => {
  describe('GET /api/rbac/modules', () => {
    test('returns modules list', async () => {
      const { app, superadminToken } = await loadAppWithMockedDb();
      const res = await request(app).get('/api/rbac/modules').set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toContain('Management Product');
      expect(res.body).toContain('Role & Permission');
    });
  });

  describe('GET /api/rbac/roles', () => {
    test('returns roles list', async () => {
      const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
      mockPool.query.mockResolvedValueOnce([[{ id: 1, name: 'superadmin' }, { id: 2, name: 'user' }], []]);

      const res = await request(app).get('/api/rbac/roles').set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
    });

    test('returns 500 on server error', async () => {
      const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
      mockPool.query.mockRejectedValueOnce(new Error('DB fail'));

      const res = await request(app).get('/api/rbac/roles').set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/rbac/roles', () => {
    test('returns 400 when name is missing', async () => {
      const { app, superadminToken } = await loadAppWithMockedDb();
      const res = await request(app).post('/api/rbac/roles').set('Authorization', `Bearer ${superadminToken}`).send({});
      expect(res.status).toBe(400);
    });

    test('creates a new role', async () => {
      const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
      mockPool.query.mockResolvedValueOnce([{ insertId: 5 }, []]);

      const res = await request(app).post('/api/rbac/roles').set('Authorization', `Bearer ${superadminToken}`).send({ name: 'testrole' });
      expect(res.status).toBe(201);
      expect(res.body.id).toBe(5);
      expect(res.body.name).toBe('testrole');
    });

    test('returns 409 on duplicate entry', async () => {
      const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
      const err = new Error('Duplicate');
      err.code = 'ER_DUP_ENTRY';
      mockPool.query.mockRejectedValueOnce(err);

      const res = await request(app).post('/api/rbac/roles').set('Authorization', `Bearer ${superadminToken}`).send({ name: 'existing' });
      expect(res.status).toBe(409);
    });

    test('returns 500 on server error', async () => {
      const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
      mockPool.query.mockRejectedValueOnce(new Error('DB fail'));

      const res = await request(app).post('/api/rbac/roles').set('Authorization', `Bearer ${superadminToken}`).send({ name: 'test' });
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/rbac/roles/:id', () => {
    test('returns 400 for invalid id (falsy)', async () => {
      const { app, superadminToken } = await loadAppWithMockedDb();
      const res = await request(app).delete('/api/rbac/roles/0').set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(400);
    });

    test('returns 404 when role not found', async () => {
      const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
      mockPool.query.mockResolvedValueOnce([[], []]);

      const res = await request(app).delete('/api/rbac/roles/999').set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(404);
    });

    test('cannot delete superadmin role', async () => {
      const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
      mockPool.query.mockResolvedValueOnce([[{ name: 'superadmin' }], []]);

      const res = await request(app).delete('/api/rbac/roles/1').set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(403);
    });

    test('successfully deletes a role and its permissions', async () => {
      const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
      mockPool.query
        .mockResolvedValueOnce([[{ name: 'testrole' }], []])
        .mockResolvedValueOnce([{}, []])
        .mockResolvedValueOnce([{}, []]);

      const res = await request(app).delete('/api/rbac/roles/3').set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(200);
    });

    test('returns 500 on server error', async () => {
      const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
      mockPool.query.mockRejectedValueOnce(new Error('DB fail'));

      const res = await request(app).delete('/api/rbac/roles/2').set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/rbac/permissions', () => {
    test('returns 400 when both roleId and roleName are missing', async () => {
      const { app, superadminToken } = await loadAppWithMockedDb();
      const res = await request(app).get('/api/rbac/permissions').set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(400);
    });

    test('returns default false permissions when roleName not found in DB', async () => {
      const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
      mockPool.query.mockResolvedValueOnce([[], []]);

      const res = await request(app).get('/api/rbac/permissions?roleName=nonexistent').set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      res.body.forEach(p => {
        expect(p.create).toBe(false);
        expect(p.show).toBe(false);
      });
    });

    test('returns permissions by roleName when found', async () => {
      const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
      mockPool.query
        .mockResolvedValueOnce([[{ id: 2 }], []])
        .mockResolvedValueOnce([[{ module: 'Management Product', action: 'show', allowed: 1 }], []]);

      const res = await request(app).get('/api/rbac/permissions?roleName=user').set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(200);
    });

    test('returns permissions by roleId', async () => {
      const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
      mockPool.query.mockResolvedValueOnce([[{ module: 'Management Product', action: 'show', allowed: 1 }], []]);

      const res = await request(app).get('/api/rbac/permissions?roleId=1').set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(200);
    });

    test('returns 500 on server error', async () => {
      const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
      mockPool.query.mockRejectedValueOnce(new Error('DB fail'));

      const res = await request(app).get('/api/rbac/permissions?roleId=1').set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/rbac/permissions bulk update', () => {
    test('returns 400 when roleId is missing in bulk payload', async () => {
      const { app, superadminToken } = await loadAppWithMockedDb();
      const res = await request(app).put('/api/rbac/permissions').set('Authorization', `Bearer ${superadminToken}`).send({ permissions: [] });
      expect(res.status).toBe(400);
    });

    test('successfully performs bulk update', async () => {
      const { app, mockConnection, superadminToken } = await loadAppWithMockedDb();
      mockConnection.query.mockResolvedValue([{}, []]);

      const res = await request(app).put('/api/rbac/permissions').set('Authorization', `Bearer ${superadminToken}`).send({
        roleId: 2,
        permissions: [{ module: 'Management Product', create: true, edit: false, delete: false, show: true }],
      });
      expect(res.status).toBe(200);
    });

    test('rolls back on bulk update error', async () => {
      const { app, mockConnection, superadminToken } = await loadAppWithMockedDb();
      mockConnection.query.mockRejectedValue(new Error('DB fail'));

      const res = await request(app).put('/api/rbac/permissions').set('Authorization', `Bearer ${superadminToken}`).send({
        roleId: 2,
        permissions: [{ module: 'Management Product', create: true }],
      });
      expect(res.status).toBe(500);
      expect(mockConnection.rollback).toHaveBeenCalled();
    });
  });

  describe('PUT /api/rbac/permissions single update', () => {
    test('returns 400 when required fields are missing', async () => {
      const { app, superadminToken } = await loadAppWithMockedDb();
      const res = await request(app).put('/api/rbac/permissions').set('Authorization', `Bearer ${superadminToken}`).send({});
      expect(res.status).toBe(400);
    });

    test('successfully updates single permission with allowed=true', async () => {
      const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
      mockPool.query.mockResolvedValueOnce([{}, []]);

      const res = await request(app).put('/api/rbac/permissions').set('Authorization', `Bearer ${superadminToken}`).send({
        roleId: 1, module: 'Management Product', action: 'show', allowed: true,
      });
      expect(res.status).toBe(200);
    });

    test('successfully updates single permission with allowed=false', async () => {
      const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
      mockPool.query.mockResolvedValueOnce([{}, []]);

      const res = await request(app).put('/api/rbac/permissions').set('Authorization', `Bearer ${superadminToken}`).send({
        roleId: 1, module: 'Management Product', action: 'hide', allowed: false,
      });
      expect(res.status).toBe(200);
    });

    test('returns 500 on server error', async () => {
      const { app, mockPool, superadminToken } = await loadAppWithMockedDb();
      mockPool.query.mockRejectedValueOnce(new Error('DB fail'));

      const res = await request(app).put('/api/rbac/permissions').set('Authorization', `Bearer ${superadminToken}`).send({
        roleId: 1, module: 'Management Product', action: 'show', allowed: true,
      });
      expect(res.status).toBe(500);
    });
  });
});
