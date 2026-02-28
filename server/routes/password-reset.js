const crypto = require('crypto');
const nodemailer = require('nodemailer');

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const s = email.trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function generateSixDigitCode() {
  const n = crypto.randomInt(0, 1000000);
  return n.toString().padStart(6, '0');
}

function buildResetCodeEmailHtml({ code }) {
  const brand = '#22c55e'; // Green 500
  const border = '#f1f5f9';
  const muted = '#64748b';
  const text = '#0f172a';
  const bg = '#f8fafc';

  return `
  <div style="margin:0;padding:0;background:${bg};font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
    <div style="max-width:560px;margin:0 auto;padding:28px 16px;">
      <div style="background:#fff;border:1px solid ${border};border-radius:16px;overflow:hidden;">
        <div style="padding:18px 22px;background:linear-gradient(135deg, ${brand} 0%, #16a34a 100%);">
          <div style="font-size:14px;color:#fff;opacity:.95;letter-spacing:.2px;">Apotek Sumber Waras</div>
          <div style="margin-top:6px;font-size:18px;color:#fff;font-weight:700;">Kode Reset Password</div>
        </div>
        <div style="padding:22px;">
          <div style="font-size:14px;color:${text};line-height:1.6;">
            Kami menerima permintaan reset password untuk akun Anda. Gunakan kode berikut untuk melanjutkan:
          </div>
          <div style="margin:18px 0;background:${bg};border:1px dashed ${border};border-radius:14px;padding:18px;text-align:center;">
            <div style="font-size:28px;letter-spacing:10px;font-weight:800;color:${text};">${code}</div>
            <div style="margin-top:8px;font-size:12px;color:${muted};">Kode ini berlaku selama <b>3 menit</b>.</div>
          </div>
          <div style="font-size:13px;color:${muted};line-height:1.6;">
            Jika Anda tidak merasa melakukan permintaan ini, abaikan email ini. Demi keamanan, jangan pernah bagikan kode ini kepada siapa pun.
          </div>
        </div>
        <div style="padding:14px 22px;border-top:1px solid ${border};font-size:12px;color:${muted};">
          © ${new Date().getFullYear()} Apotek Sumber Waras
        </div>
      </div>
    </div>
  </div>
  `;
}

module.exports = function registerPasswordResetRoutes(app, pool, bcrypt) {
  // Create reusable transporter object using the default SMTP transport
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  app.post('/api/auth/forgot-password', async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Email tidak valid' });
    }

    if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
      console.error('Nodemailer credentials missing');
      return res.status(500).json({ message: 'Email service belum dikonfigurasi (Credentials missing)' });
    }

    try {
      const [users] = await pool.query('SELECT id, username, email FROM users WHERE email = ? LIMIT 1', [email]);

      if (users.length === 0) {
        // Return success even if email not found to prevent enumeration
        return res.status(404).json({ message: 'Email tidak terdaftar di database kami' });
      }

      const code = generateSixDigitCode();
      const codeHash = await bcrypt.hash(code, 10);

      await pool.query(
        `INSERT INTO password_reset_requests (email, code_hash, code_expires_at)
         VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 3 MINUTE))`,
        [email, codeHash]
      );

      const html = buildResetCodeEmailHtml({ code });

      const info = await transporter.sendMail({
        from: `"Apotek Sumber Waras" <${process.env.MAIL_USER}>`, // sender address
        to: email, // list of receivers
        subject: 'Kode Reset Password - Apotek Sumber Waras', // Subject line
        html: html, // html body
      });

      console.log('Message sent: %s', info.messageId);
      return res.json({ message: 'Jika email terdaftar, kode akan dikirim.' });
    } catch (e) {
      console.error('Password reset error:', e);
      return res.status(500).json({ message: 'Server error: ' + e.message });
    }
  });

  app.post('/api/auth/verify-reset-code', async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    if (!isValidEmail(email)) return res.status(400).json({ message: 'Email tidak valid' });
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ message: 'Kode tidak valid' });

    try {
      const [rows] = await pool.query(
        `SELECT id, code_hash
         FROM password_reset_requests
         WHERE email = ?
           AND used_at IS NULL
           AND code_expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 1`,
        [email]
      );

      if (rows.length === 0) return res.status(400).json({ message: 'Kode salah atau sudah kedaluwarsa' });

      const row = rows[0];
      const ok = await bcrypt.compare(code, row.code_hash);
      if (!ok) return res.status(400).json({ message: 'Kode salah atau sudah kedaluwarsa' });

      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = await bcrypt.hash(resetToken, 10);

      await pool.query(
        `UPDATE password_reset_requests
         SET verified_at = NOW(),
             reset_token_hash = ?,
             reset_token_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE)
         WHERE id = ?`,
        [resetTokenHash, row.id]
      );

      return res.json({ resetToken });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ message: 'Server error' });
    }
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const resetToken = typeof req.body?.resetToken === 'string' ? req.body.resetToken.trim() : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (!isValidEmail(email)) return res.status(400).json({ message: 'Email tidak valid' });
    if (!resetToken) return res.status(400).json({ message: 'Token tidak valid' });
    if (newPassword.trim().length < 6) return res.status(400).json({ message: 'Password minimal 6 karakter' });

    try {
      const [rows] = await pool.query(
        `SELECT id, reset_token_hash
         FROM password_reset_requests
         WHERE email = ?
           AND used_at IS NULL
           AND reset_token_hash IS NOT NULL
           AND reset_token_expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 1`,
        [email]
      );

      if (rows.length === 0) return res.status(400).json({ message: 'Permintaan reset tidak valid atau sudah kedaluwarsa' });

      const row = rows[0];
      const ok = await bcrypt.compare(resetToken, row.reset_token_hash);
      if (!ok) return res.status(400).json({ message: 'Permintaan reset tidak valid atau sudah kedaluwarsa' });

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const [result] = await pool.query('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email]);
      if (!result.affectedRows) return res.status(400).json({ message: 'Email tidak terdaftar' });

      await pool.query('UPDATE password_reset_requests SET used_at = NOW() WHERE id = ?', [row.id]);

      return res.json({ message: 'Password berhasil diperbarui' });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ message: 'Server error' });
    }
  });
};
