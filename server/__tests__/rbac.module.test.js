const request = require('supertest');
const jwt = require('jsonwebtoken');

const MODULE_CONFIG = {
  'Management Product': ['create', 'edit', 'delete', 'show'],
  'Transactions': ['create', 'show'],
  'Management Pengguna': ['create', 'edit', 'delete', 'show'],
  'Sales Report': ['show', 'create'],
  'Peramalan Stok': ['show'],
  'Substitutions': ['show'],
  'Suppliers': ['create', 'edit', 'delete', 'show'],
  'Stock Opname': ['create', 'show'],
  'Role & Permission': ['show', 'create', 'edit', 'delete'],
  'Transaction Setting': ['show', 'edit'],
  'Audit Trail': ['show'],
  'Approval Faktur': ['show', 'edit'],
  'Riwayat Pembelian': ['show'],
  'Resep Dokter': ['create', 'edit', 'delete', 'show'],
  'Auth': ['login', 'register'],
};

const ALL_ACTIONS = ['create', 'edit', 'delete', 'show', 'login', 'register'];

async function loadApp() {
  process.env.JWT_SECRET = 'test_jwt_secret';
  jest.resetModules();

  const mockConn = {
    query: jest.fn(),
    beginTransaction: jest.fn().mockResolvedValue(),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    release: jest.fn(),
  };

  const mockPool = {
    query: jest.fn(),
    getConnection: jest.fn().mockResolvedValue(mockConn),
  };

  jest.doMock('../db', () => ({
    pool: mockPool,
    initDB: jest.fn().mockResolvedValue(),
  }));

  const { app, authenticate, checkPermission } = require('../index');

  const superToken = jwt.sign(
    { id: 1, username: 'admin', role: 'superadmin', email: 'a@a.com' },
    process.env.JWT_SECRET, { expiresIn: '1h' }
  );
  const userToken = jwt.sign(
    { id: 2, username: 'u', role: 'user', email: 'u@u.com' },
    process.env.JWT_SECRET, { expiresIn: '1h' }
  );

  return { app, mockPool, mockConn, superToken, userToken, authenticate, checkPermission };
}

describe('RBAC checkPermission - All Modules from MODULE_CONFIG', () => {
  describe('Allow valid module+action combinations', () => {
    for (const [module, actions] of Object.entries(MODULE_CONFIG)) {
      for (const action of actions) {
        test(`${module}:${action} allows access when permission granted`, async () => {
          if (module === 'Auth') return;
          const { app, mockPool, userToken, authenticate, checkPermission } = await loadApp();
          const route = `/_test_${module.replace(/[^a-zA-Z]/g, '')}_${action}`;
          app.get(route, authenticate, checkPermission(module, action), (req, res) => res.json({ ok: true }));
          mockPool.query
            .mockResolvedValueOnce([[{ id: 2 }]])
            .mockResolvedValueOnce([[{ allowed: 1 }]]);

          const res = await request(app).get(route).set('Authorization', `Bearer ${userToken}`);
          expect(res.status).toBe(200);
        });
      }
    }
  });

  describe('Deny module+action not in MODULE_CONFIG', () => {
    for (const [module, actions] of Object.entries(MODULE_CONFIG)) {
      if (module === 'Auth') continue;
      const invalidActions = ALL_ACTIONS.filter(a => !actions.includes(a));
      if (invalidActions.length === 0) continue;

      for (const invalidAction of invalidActions) {
        test(`${module}:${invalidAction} is denied (not in config)`, async () => {
          const { app, mockPool, userToken, authenticate, checkPermission } = await loadApp();
          const route = `/_test_${module.replace(/[^a-zA-Z]/g, '')}_${invalidAction}`;
          app.get(route, authenticate, checkPermission(module, invalidAction), (req, res) => res.json({ ok: true }));
          mockPool.query
            .mockResolvedValueOnce([[{ id: 2 }]])
            .mockResolvedValueOnce([[{ allowed: 0 }]]);

          const res = await request(app).get(route).set('Authorization', `Bearer ${userToken}`);
          expect(res.status).toBe(403);
        });
      }
    }
  });

  describe('All modules return 401 without auth', () => {
    for (const [module] of Object.entries(MODULE_CONFIG)) {
      if (module === 'Auth') continue;
      test(`${module} returns 401 without token`, async () => {
        const { app, authenticate, checkPermission } = await loadApp();
        const route = `/_test_unauth_${module.replace(/[^a-zA-Z]/g, '')}`;
        app.get(route, authenticate, checkPermission(module, 'show'), (req, res) => res.json({ ok: true }));
        const res = await request(app).get(route);
        expect(res.status).toBe(401);
      });
    }
  });
});

describe('RBAC checkPermission - Branch Coverage', () => {
  test('superadmin bypass for Role & Permission module', async () => {
    const { app, superToken, authenticate, checkPermission } = await loadApp();
    app.get('/_bypass_role', authenticate, checkPermission('Role & Permission', 'show'), (req, res) => res.json({ ok: true }));
    const res = await request(app).get('/_bypass_role').set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
  });

  test('superadmin bypass for Transaction Setting module', async () => {
    const { app, superToken, authenticate, checkPermission } = await loadApp();
    app.get('/_bypass_trans', authenticate, checkPermission('Transaction Setting', 'edit'), (req, res) => res.json({ ok: true }));
    const res = await request(app).get('/_bypass_trans').set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
  });

  test('superadmin role not found in roles table - fallback to next()', async () => {
    const { app, mockPool, superToken } = await loadApp();
    mockPool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id: 1, name: 'Test', stock: 10 }]]);

    const res = await request(app).get('/api/forecast/products').set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
  });

  test('non-superadmin role not found returns 403', async () => {
    const { app, mockPool, userToken } = await loadApp();
    mockPool.query.mockResolvedValue([[], []]);
    const res = await request(app).get('/api/forecast/products').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });

  test('superadmin fallback when no permission records exist', async () => {
    const { app, mockPool, superToken } = await loadApp();
    mockPool.query
      .mockResolvedValueOnce([[{ id: 1 }]])
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[{ id: 1, name: 'Test', stock: 10 }]]);

    const res = await request(app).get('/api/forecast/products').set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
  });

  test('non-superadmin no permission records returns 403', async () => {
    const { app, mockPool, userToken } = await loadApp();
    mockPool.query
      .mockResolvedValueOnce([[{ id: 2 }]])
      .mockResolvedValueOnce([[], []]);
    const res = await request(app).get('/api/forecast/products').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });

  test('permission exists and allowed passes', async () => {
    const { app, mockPool, userToken } = await loadApp();
    mockPool.query
      .mockResolvedValueOnce([[{ id: 2 }]])
      .mockResolvedValueOnce([[{ allowed: 1 }]])
      .mockResolvedValueOnce([[{ id: 1, name: 'P', stock: 10 }]]);
    const res = await request(app).get('/api/forecast/products').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
  });

  test('permission exists but not allowed returns 403', async () => {
    const { app, mockPool, userToken } = await loadApp();
    mockPool.query
      .mockResolvedValueOnce([[{ id: 2 }]])
      .mockResolvedValueOnce([[{ allowed: 0 }]]);
    const res = await request(app).get('/api/forecast/products').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });

  test('DB error returns 500', async () => {
    const { app, mockPool, userToken } = await loadApp();
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockPool.query.mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/api/forecast/products').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(500);
    spy.mockRestore();
  });
});

describe('requireSuperadmin middleware', () => {
  test('non-superadmin creating role returns 403', async () => {
    const { app, userToken } = await loadApp();
    const res = await request(app).post('/api/rbac/roles').set('Authorization', `Bearer ${userToken}`).send({ name: 'x' });
    expect(res.status).toBe(403);
  });

  test('non-superadmin deleting role returns 403', async () => {
    const { app, userToken } = await loadApp();
    const res = await request(app).delete('/api/rbac/roles/1').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });

  test('non-superadmin updating permissions returns 403', async () => {
    const { app, userToken } = await loadApp();
    const res = await request(app).put('/api/rbac/permissions').set('Authorization', `Bearer ${userToken}`).send({ roleId: 1, permissions: [] });
    expect(res.status).toBe(403);
  });

  test('superadmin creating role succeeds', async () => {
    const { app, mockPool, superToken } = await loadApp();
    mockPool.query.mockResolvedValue([{ insertId: 10 }]);
    const res = await request(app).post('/api/rbac/roles').set('Authorization', `Bearer ${superToken}`).send({ name: 'newrole' });
    expect(res.status).toBe(201);
  });
});

describe('RBAC Endpoints', () => {
  test('GET /api/rbac/modules returns module list', async () => {
    const { app, superToken } = await loadApp();
    const res = await request(app).get('/api/rbac/modules').set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toContain('Management Product');
  });

  test('GET /api/rbac/roles returns roles', async () => {
    const { app, mockPool, superToken } = await loadApp();
    mockPool.query.mockResolvedValue([[{ id: 1, name: 'admin' }]]);
    const res = await request(app).get('/api/rbac/roles').set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
  });

  test('GET /api/rbac/roles server error returns 500', async () => {
    const { app, mockPool, superToken } = await loadApp();
    mockPool.query.mockRejectedValue(new Error('fail'));
    const res = await request(app).get('/api/rbac/roles').set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(500);
  });

  test('POST /api/rbac/roles missing name returns 400', async () => {
    const { app, superToken } = await loadApp();
    const res = await request(app).post('/api/rbac/roles').set('Authorization', `Bearer ${superToken}`).send({});
    expect(res.status).toBe(400);
  });

  test('POST /api/rbac/roles duplicate returns 409', async () => {
    const { app, mockPool, superToken } = await loadApp();
    const e = new Error('dup'); e.code = 'ER_DUP_ENTRY';
    mockPool.query.mockRejectedValue(e);
    const res = await request(app).post('/api/rbac/roles').set('Authorization', `Bearer ${superToken}`).send({ name: 'dup' });
    expect(res.status).toBe(409);
  });

  test('DELETE /api/rbac/roles/:id invalid id returns 400', async () => {
    const { app, superToken } = await loadApp();
    const res = await request(app).delete('/api/rbac/roles/0').set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(400);
  });

  test('DELETE /api/rbac/roles/:id not found returns 404', async () => {
    const { app, mockPool, superToken } = await loadApp();
    mockPool.query.mockResolvedValue([[], []]);
    const res = await request(app).delete('/api/rbac/roles/999').set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(404);
  });

  test('DELETE /api/rbac/roles/:id superadmin protection returns 403', async () => {
    const { app, mockPool, superToken } = await loadApp();
    mockPool.query.mockResolvedValue([[{ name: 'superadmin' }]]);
    const res = await request(app).delete('/api/rbac/roles/1').set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(403);
  });

  test('DELETE /api/rbac/roles/:id success', async () => {
    const { app, mockPool, superToken } = await loadApp();
    mockPool.query
      .mockResolvedValueOnce([[{ name: 'testrole' }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);
    const res = await request(app).delete('/api/rbac/roles/5').set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
  });

  test('DELETE /api/rbac/roles/:id server error', async () => {
    const { app, mockPool, superToken } = await loadApp();
    mockPool.query.mockRejectedValue(new Error('fail'));
    const res = await request(app).delete('/api/rbac/roles/5').set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(500);
  });

  test('GET /api/rbac/permissions missing params returns 400', async () => {
    const { app, superToken } = await loadApp();
    const res = await request(app).get('/api/rbac/permissions').set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(400);
  });

  test('GET /api/rbac/permissions by roleName not found returns defaults', async () => {
    const { app, mockPool, superToken } = await loadApp();
    mockPool.query.mockResolvedValue([[], []]);
    const res = await request(app).get('/api/rbac/permissions?roleName=nonexistent').set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    res.body.forEach(p => { expect(p.create).toBe(false); });
  });

  test('GET /api/rbac/permissions by roleName found returns permissions', async () => {
    const { app, mockPool, superToken } = await loadApp();
    mockPool.query
      .mockResolvedValueOnce([[{ id: 2 }]])
      .mockResolvedValueOnce([[{ module: 'Management Product', action: 'show', allowed: 1 }]]);
    const res = await request(app).get('/api/rbac/permissions?roleName=user').set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
  });

  test('GET /api/rbac/permissions by roleId returns permissions', async () => {
    const { app, mockPool, superToken } = await loadApp();
    mockPool.query.mockResolvedValue([[{ module: 'Management Product', action: 'show', allowed: 1 }]]);
    const res = await request(app).get('/api/rbac/permissions?roleId=1').set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
  });

  test('GET /api/rbac/permissions server error returns 500', async () => {
    const { app, mockPool, superToken } = await loadApp();
    mockPool.query.mockRejectedValue(new Error('fail'));
    const res = await request(app).get('/api/rbac/permissions?roleId=1').set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(500);
  });

  test('PUT /api/rbac/permissions bulk missing roleId returns 400', async () => {
    const { app, superToken } = await loadApp();
    const res = await request(app).put('/api/rbac/permissions').set('Authorization', `Bearer ${superToken}`).send({ permissions: [] });
    expect(res.status).toBe(400);
  });

  test('PUT /api/rbac/permissions bulk update success', async () => {
    const { app, mockConn, superToken } = await loadApp();
    mockConn.query.mockResolvedValue([{}]);
    const res = await request(app).put('/api/rbac/permissions').set('Authorization', `Bearer ${superToken}`).send({
      roleId: 1, permissions: [{ module: 'Management Product', create: true, show: true }],
    });
    expect(res.status).toBe(200);
  });

  test('PUT /api/rbac/permissions bulk update rollback on error', async () => {
    const { app, mockConn, superToken } = await loadApp();
    mockConn.query.mockRejectedValue(new Error('fail'));
    const res = await request(app).put('/api/rbac/permissions').set('Authorization', `Bearer ${superToken}`).send({
      roleId: 1, permissions: [{ module: 'Management Product', create: true }],
    });
    expect(res.status).toBe(500);
    expect(mockConn.rollback).toHaveBeenCalled();
  });

  test('PUT /api/rbac/permissions single missing params returns 400', async () => {
    const { app, superToken } = await loadApp();
    const res = await request(app).put('/api/rbac/permissions').set('Authorization', `Bearer ${superToken}`).send({});
    expect(res.status).toBe(400);
  });

  test('PUT /api/rbac/permissions single update success with allowed=true', async () => {
    const { app, mockPool, superToken } = await loadApp();
    mockPool.query.mockResolvedValue([{}]);
    const res = await request(app).put('/api/rbac/permissions').set('Authorization', `Bearer ${superToken}`).send({
      roleId: 1, module: 'Management Product', action: 'show', allowed: true,
    });
    expect(res.status).toBe(200);
  });

  test('PUT /api/rbac/permissions single update success with allowed=false', async () => {
    const { app, mockPool, superToken } = await loadApp();
    mockPool.query.mockResolvedValue([{}]);
    const res = await request(app).put('/api/rbac/permissions').set('Authorization', `Bearer ${superToken}`).send({
      roleId: 1, module: 'Management Product', action: 'hide', allowed: false,
    });
    expect(res.status).toBe(200);
  });

  test('PUT /api/rbac/permissions single update error', async () => {
    const { app, mockPool, superToken } = await loadApp();
    mockPool.query.mockRejectedValue(new Error('fail'));
    const res = await request(app).put('/api/rbac/permissions').set('Authorization', `Bearer ${superToken}`).send({
      roleId: 1, module: 'Management Product', action: 'show', allowed: true,
    });
    expect(res.status).toBe(500);
  });

  test('authenticate with invalid token returns 401', async () => {
    const { app } = await loadApp();
    const res = await request(app).get('/api/rbac/modules').set('Authorization', 'Bearer badtoken');
    expect(res.status).toBe(401);
  });

  test('authenticate without token returns 401', async () => {
    const { app } = await loadApp();
    const res = await request(app).get('/api/rbac/modules');
    expect(res.status).toBe(401);
  });
});
