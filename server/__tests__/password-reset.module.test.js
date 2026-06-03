jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn(),
  })),
}));

const crypto = require('crypto');
const nodemailer = require('nodemailer');
const express = require('express');
const request = require('supertest');

const registerPasswordResetRoutes = require('../routes/password-reset');

function buildApp({ pool, bcrypt }) {
  const app = express();
  app.use(express.json());
  registerPasswordResetRoutes(app, pool, bcrypt);
  return app;
}

describe('password-reset module', () => {
  beforeEach(() => {
    delete process.env.MAIL_USER;
    delete process.env.MAIL_PASS;
  });

  test('helpers cover branches', () => {
    expect(registerPasswordResetRoutes._test.isValidEmail(123)).toBe(false);
    expect(registerPasswordResetRoutes._test.isValidEmail('   ')).toBe(false);
    expect(registerPasswordResetRoutes._test.isValidEmail('a@b.com')).toBe(true);

    const code = registerPasswordResetRoutes._test.generateSixDigitCode();
    expect(/^\d{6}$/.test(code)).toBe(true);

    const html = registerPasswordResetRoutes._test.buildResetCodeEmailHtml({ code: '123456' });
    expect(html).toContain('123456');
  });

  test('POST /api/auth/forgot-password invalid email returns 400', async () => {
    const pool = { query: jest.fn() };
    const app = buildApp({ pool, bcrypt: {} });

    const res1 = await request(app).post('/api/auth/forgot-password').send({ email: '' });
    expect(res1.status).toBe(400);

    const res2 = await request(app).post('/api/auth/forgot-password').send({ email: 123 });
    expect(res2.status).toBe(400);
  });

  test('POST /api/auth/forgot-password missing credentials returns 500', async () => {
    const pool = { query: jest.fn() };
    const app = buildApp({ pool, bcrypt: {} });

    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'a@b.com' });
    expect(res.status).toBe(500);
  });

  test('POST /api/auth/forgot-password email not found returns 404', async () => {
    process.env.MAIL_USER = 'u';
    process.env.MAIL_PASS = 'p';

    const pool = { query: jest.fn().mockResolvedValueOnce([[], []]) };
    const app = buildApp({ pool, bcrypt: { hash: jest.fn() } });

    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'a@b.com' });
    expect(res.status).toBe(404);
  });

  test('POST /api/auth/forgot-password success sends email and returns 200', async () => {
    process.env.MAIL_USER = 'u';
    process.env.MAIL_PASS = 'p';

    jest.spyOn(crypto, 'randomInt').mockReturnValueOnce(1);

    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[{ id: 1, username: 'u', email: 'a@b.com' }], []])
        .mockResolvedValueOnce([{}, []]),
    };
    const bcrypt = { hash: jest.fn().mockResolvedValue('hash') };
    const app = buildApp({ pool, bcrypt });

    const transporter = nodemailer.createTransport.mock.results[0].value;
    transporter.sendMail.mockResolvedValueOnce({ messageId: 'm1' });

    const res = await request(app).post('/api/auth/forgot-password').send({ email: ' a@b.com ' });
    expect(res.status).toBe(200);

    crypto.randomInt.mockRestore();
  });

  test('POST /api/auth/forgot-password error returns 500', async () => {
    process.env.MAIL_USER = 'u';
    process.env.MAIL_PASS = 'p';

    const pool = { query: jest.fn().mockRejectedValueOnce(new Error('db')) };
    const app = buildApp({ pool, bcrypt: { hash: jest.fn() } });

    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'a@b.com' });
    expect(res.status).toBe(500);
  });

  test('POST /api/auth/verify-reset-code invalid email/code returns 400', async () => {
    const pool = { query: jest.fn() };
    const app = buildApp({ pool, bcrypt: {} });

    const res1 = await request(app).post('/api/auth/verify-reset-code').send({ email: 'no', code: '123456' });
    expect(res1.status).toBe(400);

    const res2 = await request(app).post('/api/auth/verify-reset-code').send({ email: 'a@b.com', code: 'x' });
    expect(res2.status).toBe(400);

    const res3 = await request(app).post('/api/auth/verify-reset-code').send({ email: 123, code: 123 });
    expect(res3.status).toBe(400);
  });

  test('POST /api/auth/verify-reset-code no rows returns 400', async () => {
    const pool = { query: jest.fn().mockResolvedValueOnce([[], []]) };
    const app = buildApp({ pool, bcrypt: { compare: jest.fn() } });

    const res = await request(app).post('/api/auth/verify-reset-code').send({ email: 'a@b.com', code: '123456' });
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/verify-reset-code compare false returns 400', async () => {
    const pool = { query: jest.fn().mockResolvedValueOnce([[{ id: 1, code_hash: 'h' }], []]) };
    const bcrypt = { compare: jest.fn().mockResolvedValue(false), hash: jest.fn() };
    const app = buildApp({ pool, bcrypt });

    const res = await request(app).post('/api/auth/verify-reset-code').send({ email: 'a@b.com', code: '123456' });
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/verify-reset-code success returns resetToken', async () => {
    jest.spyOn(crypto, 'randomBytes').mockReturnValueOnce(Buffer.from('a'.repeat(32)));

    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[{ id: 1, code_hash: 'h' }], []])
        .mockResolvedValueOnce([{}, []]),
    };
    const bcrypt = { compare: jest.fn().mockResolvedValue(true), hash: jest.fn().mockResolvedValue('th') };
    const app = buildApp({ pool, bcrypt });

    const res = await request(app).post('/api/auth/verify-reset-code').send({ email: 'a@b.com', code: '123456' });
    expect(res.status).toBe(200);
    expect(typeof res.body.resetToken).toBe('string');

    crypto.randomBytes.mockRestore();
  });

  test('POST /api/auth/verify-reset-code error returns 500', async () => {
    const pool = { query: jest.fn().mockRejectedValueOnce(new Error('db')) };
    const app = buildApp({ pool, bcrypt: { compare: jest.fn() } });

    const res = await request(app).post('/api/auth/verify-reset-code').send({ email: 'a@b.com', code: '123456' });
    expect(res.status).toBe(500);
  });

  test('POST /api/auth/reset-password invalid input returns 400', async () => {
    const pool = { query: jest.fn() };
    const app = buildApp({ pool, bcrypt: {} });

    const res1 = await request(app).post('/api/auth/reset-password').send({ email: 'no', resetToken: 't', newPassword: '123456' });
    expect(res1.status).toBe(400);

    const res2 = await request(app).post('/api/auth/reset-password').send({ email: 'a@b.com', resetToken: '', newPassword: '123456' });
    expect(res2.status).toBe(400);

    const res3 = await request(app).post('/api/auth/reset-password').send({ email: 'a@b.com', resetToken: 't', newPassword: '123' });
    expect(res3.status).toBe(400);

    const res4 = await request(app).post('/api/auth/reset-password').send({ email: 123, resetToken: 123, newPassword: 123 });
    expect(res4.status).toBe(400);
  });

  test('POST /api/auth/reset-password no rows returns 400', async () => {
    const pool = { query: jest.fn().mockResolvedValueOnce([[], []]) };
    const app = buildApp({ pool, bcrypt: { compare: jest.fn() } });

    const res = await request(app).post('/api/auth/reset-password').send({ email: 'a@b.com', resetToken: 't', newPassword: '123456' });
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/reset-password compare false returns 400', async () => {
    const pool = { query: jest.fn().mockResolvedValueOnce([[{ id: 1, reset_token_hash: 'h' }], []]) };
    const app = buildApp({ pool, bcrypt: { compare: jest.fn().mockResolvedValue(false), hash: jest.fn() } });

    const res = await request(app).post('/api/auth/reset-password').send({ email: 'a@b.com', resetToken: 't', newPassword: '123456' });
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/reset-password affectedRows 0 returns 400', async () => {
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[{ id: 1, reset_token_hash: 'h' }], []])
        .mockResolvedValueOnce([{ affectedRows: 0 }, []]),
    };
    const bcrypt = { compare: jest.fn().mockResolvedValue(true), hash: jest.fn().mockResolvedValue('ph') };
    const app = buildApp({ pool, bcrypt });

    const res = await request(app).post('/api/auth/reset-password').send({ email: 'a@b.com', resetToken: 't', newPassword: '123456' });
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/reset-password success returns 200', async () => {
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[{ id: 1, reset_token_hash: 'h' }], []])
        .mockResolvedValueOnce([{ affectedRows: 1 }, []])
        .mockResolvedValueOnce([{}, []]),
    };
    const bcrypt = { compare: jest.fn().mockResolvedValue(true), hash: jest.fn().mockResolvedValue('ph') };
    const app = buildApp({ pool, bcrypt });

    const res = await request(app).post('/api/auth/reset-password').send({ email: 'a@b.com', resetToken: 't', newPassword: '123456' });
    expect(res.status).toBe(200);
  });

  test('POST /api/auth/reset-password error returns 500', async () => {
    const pool = { query: jest.fn().mockRejectedValueOnce(new Error('db')) };
    const app = buildApp({ pool, bcrypt: { compare: jest.fn() } });

    const res = await request(app).post('/api/auth/reset-password').send({ email: 'a@b.com', resetToken: 't', newPassword: '123456' });
    expect(res.status).toBe(500);
  });
});
