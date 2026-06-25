const { createJournalEntry } = require('../utils/journal');
const axios = require('axios');

module.exports = function registerProductRoutes(app, pool, authenticate, checkPermission, createAuditTrail) {

  app.get(
    '/api/products',
    authenticate,
    checkPermission('Management Product', 'show'),
    async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;

    try {
      const connection = await pool.getConnection();

      // Stock type priority: RETUR > BELUM_BAYAR > DP > KONSINYASI > LUNAS
      let query = `
        SELECT p.*, 
               b.supplier_id, 
               s.name AS supplier_name, 
               b.stock_type,
               (SELECT MIN(b2.expired_date) FROM batches b2 WHERE b2.product_id = p.id AND b2.is_archived = FALSE AND b2.status = 'approved') AS nearest_expired,
                sos.date AS last_opname_at,
                u_op.username AS last_opname_by
        FROM products p
        LEFT JOIN (
          SELECT b1.product_id, b1.supplier_id, b1.stock_type
          FROM batches b1
          WHERE b1.is_archived = FALSE
            AND NOT EXISTS (
              SELECT 1 FROM batches b2
              WHERE b2.product_id = b1.product_id
                AND b2.is_archived = FALSE
                AND FIELD(b2.stock_type, 'retur', 'belum_bayar', 'dp', 'konsinyasi', 'lunas')
                  < FIELD(b1.stock_type, 'retur', 'belum_bayar', 'dp', 'konsinyasi', 'lunas')
            )
          GROUP BY b1.product_id
        ) b ON p.id = b.product_id
        LEFT JOIN suppliers s ON b.supplier_id = s.id
        LEFT JOIN stock_opname_sessions sos ON sos.id = (
          SELECT MAX(sos2.id) FROM stock_opname_sessions sos2
        )
        LEFT JOIN users u_op ON sos.user_id = u_op.id
      `;
      let countQuery = 'SELECT COUNT(*) as total FROM products WHERE is_active = 1';
      let params = [];

      if (search) {
        query += ' WHERE p.status = "active" AND p.is_active = 1 AND (p.name LIKE ? OR p.description LIKE ?)';
        countQuery += ' AND status = "active" AND (name LIKE ? OR description LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      } else {
        query += ' WHERE p.status = "active" AND p.is_active = 1';
        countQuery += ' AND status = "active"';
      }

      query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const [products] = await connection.query(query, params);

      const [countResult] = await connection.query(
        countQuery,
        search ? [`%${search}%`, `%${search}%`] : []
      );
      const total = countResult[0].total;

      connection.release();

      res.json({
        data: products,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ message: 'Server error' });
    }
    }
  );

  app.post(
    '/api/products',
    authenticate,
    checkPermission('Management Product', 'create'),
    async (req, res) => {
    const { name, cost_price, selling_price, stock, category, product_category, unit, expired_date, location_code, purchase_unit, unit_multiplier, description } =
      req.body;

    if (!name || !cost_price) {
      return res
        .status(400)
        .json({ message: 'Name and cost price are required' });
    }

    // Helper function to format date for MySQL (YYYY-MM-DD)
    const formatDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      if (isNaN(d.getTime())) return null;
      return d.toISOString().split('T')[0];
    };

    try {
      // Check if this product is being created via "Add to List" with a high value
      // We'll pass a flag from the frontend if it needs approval
      const status = req.body.needsApproval ? 'pending' : 'active';

      const connection = await pool.getConnection();
      const [result] = await connection.query(
        'INSERT INTO products (name, cost_price, selling_price, stock, category, product_category, unit, expired_date, location_code, purchase_unit, unit_multiplier, status, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          name,
          cost_price,
          selling_price || 0,
          stock || 0,
          category || 'General',
          product_category || 'OBAT',
          unit || 'pcs',
          formatDate(expired_date),
          location_code || null,
          purchase_unit || 'Box',
          unit_multiplier || 1,
          status,
          description || null
        ]
      );
      connection.release();

      await createAuditTrail({
        user_id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        module: 'Management Product',
        action: 'create',
        description: `Membuat produk baru: ${name} (Status: ${status})`,
      });

      res.status(201).json({
        id: result.insertId,
        name,
        cost_price,
        selling_price,
        stock,
        category,
        product_category: product_category || 'OBAT',
        unit,
        expired_date,
        location_code,
        purchase_unit: purchase_unit || 'Box',
        unit_multiplier: unit_multiplier || 1,
        status,
        description: description || null
      });
    } catch (error) {
      console.error('Error adding product:', error);
      res.status(500).json({ message: 'Server error' });
    }
    }
  );

  app.put(
    '/api/products/:id',
    authenticate,
    checkPermission('Management Product', 'edit'),
    async (req, res) => {
    const { id } = req.params;
    const { name, cost_price, selling_price, stock, category, product_category, unit, expired_date, location_code, purchase_unit, unit_multiplier, description } =
      req.body;

    // Helper function to format date for MySQL (YYYY-MM-DD)
    const formatDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      if (isNaN(d.getTime())) return null;
      return d.toISOString().split('T')[0];
    };

    try {
      const connection = await pool.getConnection();
      
      // Get current product name
      const [currentProduct] = await connection.query('SELECT name FROM products WHERE id = ?', [id]);
      
      await connection.query(
        'UPDATE products SET name = ?, cost_price = ?, selling_price = ?, stock = ?, category = ?, product_category = ?, unit = ?, expired_date = ?, location_code = ?, purchase_unit = ?, unit_multiplier = ?, description = ? WHERE id = ?',
        [name, cost_price, selling_price, stock, category, product_category || 'OBAT', unit, formatDate(expired_date), location_code || null, purchase_unit || 'Box', unit_multiplier || 1, description || null, id]
      );
      connection.release();

      await createAuditTrail({
        user_id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        module: 'Management Product',
        action: 'edit',
        description: `Memperbarui produk: ${currentProduct[0]?.name || id} -> ${name}`,
      });

      res.json({ message: 'Product updated successfully' });
    } catch (error) {
      console.error('Error updating product:', error);
      res.status(500).json({ message: 'Server error' });
    }
    }
  );

  // GET /api/knowledge/search - Search knowledge.csv by product name
  app.get(
    '/api/knowledge/search',
    authenticate,
    async (req, res) => {
    const name = (req.query.name || '').toString().trim().toLowerCase();
    if (!name) return res.json({ data: [] });

    try {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '..', '..', 'knowledge.csv');

      if (!fs.existsSync(filePath)) return res.json({ data: [] });

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').map(l => l.trim()).filter(l => l);
      if (lines.length < 2) return res.json({ data: [] });

      const parseCSVLine = (line) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            inQuotes = !inQuotes;
          } else if (ch === ',' && !inQuotes) {
            result.push(current);
            current = '';
          } else {
            current += ch;
          }
        }
        result.push(current);
        return result;
      };

      const header = parseCSVLine(lines[0]);
      const nameIdx = header.indexOf('name');
      const descIdx = header.indexOf('description');
      const compIdx = header.indexOf('composition');
      if (nameIdx === -1) return res.json({ data: [] });

      const cleanDescription = (raw) => {
        if (!raw) return '';
        let text = raw
          .replace(/^search\s+search\s+Cari\s+[^]+?Deskripsi\s*&?\s*Manfaat\s*/i, '')
          .replace(/^search\s+search\s+Cari\s+[^]+?Deskripsi\s*/i, '')
          .replace(/Tambah ke Keranjang[^]+?(?=Deskripsi|Informasi|Indikasi|Dosis|$)/i, '')
          .replace(/Kemasan aman[^]+?(?=Deskripsi|Informasi|Indikasi|Dosis|$)/i, '')
          .replace(/Siap diantar[^]+?(?=Deskripsi|Informasi|Indikasi|Dosis|$)/i, '')
          .replace(/Dikirim dari apotek resmi\s*/i, '')
          .replace(/\*Harga berbeda di tiap apotik\*/i, '')
          .trim();
        const indikasiMatch = text.match(/Indikasi\s*(Umum|Khusus)?\s*[:.]?\s*([^]+?)(?=\s*(Komposisi|Dosis|Aturan|Informasi|Keamanan|Detail|Golongan|Manufaktur|Kemasan|No\.|Recomendasi|$))/i);
        if (indikasiMatch) {
          return indikasiMatch[2].trim().replace(/^[:\s]+/, '').replace(/\s+/g, ' ');
        }
        const descEndMatch = text.match(/^([^]+?)(?=\s*(Informasi|Dosis|Aturan|Komposisi|Keamanan|Detail|Golongan|Manufaktur|Kemasan|$))/i);
        if (descEndMatch) {
          return descEndMatch[1].trim().replace(/^[:\s]+/, '').replace(/\s+/g, ' ');
        }
        return text.substring(0, 500).trim().replace(/\s+/g, ' ');
      };

      const results = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        const productName = (cols[nameIdx] || '').trim().toLowerCase();
        if (productName.includes(name)) {
          const rawDesc = descIdx !== -1 ? cols[descIdx] || '' : '';
          results.push({
            name: cols[nameIdx] || '',
            description: cleanDescription(rawDesc),
            composition: compIdx !== -1 ? cols[compIdx] || '' : '',
          });
        }
      }

      res.json({ data: results });
    } catch (error) {
      console.error('Error searching knowledge:', error);
      res.status(500).json({ message: 'Server error' });
    }
    }
  );

  // POST /api/knowledge/ai-description - AI verifies/generates product description
  app.post(
    '/api/knowledge/ai-description',
    authenticate,
    async (req, res) => {
    const { name, knowledgeDescription } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Nama produk wajib diisi' });

    try {
      const apiKeys = [
        process.env.OPEN_ROUTER_API_1,
        process.env.OPEN_ROUTER_API_2,
        process.env.OPEN_ROUTER_API_3,
        process.env.OPEN_ROUTER_API_4,
      ].filter(Boolean);

      if (apiKeys.length === 0) {
        return res.json({ description: knowledgeDescription || '', source: 'knowledge' });
      }

      const prompt = knowledgeDescription
        ? `Produk: "${name}"
Deskripsi dari database: "${knowledgeDescription}"

Tugas: Verifikasi apakah deskripsi di atas benar untuk produk ini.
Jika benar, gunakan deskripsi tersebut.
WAJIB: Akhiri kalimat dengan "Obat ini untuk [penyakit/kondisi]."

Format jawaban HANYA teks deskripsi saja, tanpa kata lain, tanpa label.`
        : `Produk: "${name}"

Tugas: Jelaskan secara singkat obat ini digunakan untuk apa (indikasi).
WAJIB: Akhiri kalimat dengan "Obat ini untuk [penyakit/kondisi]."
Jika tidak tahu, jawab "Tidak ada informasi."

Format jawaban HANYA teks deskripsi saja, tanpa kata lain, tanpa label.`;

      const models = [
        'openai/gpt-4o-mini',
        'openai/gpt-4o',
        'deepseek/deepseek-chat-v3-0324',
        'meta-llama/llama-3.3-70b-instruct',
        'cohere/command-r-plus-08-2024',
      ];

      let lastError = null;
      for (const key of apiKeys) {
        for (const model of models) {
          try {
            const { data } = await axios.post(
              'https://openrouter.ai/api/v1/chat/completions',
              {
                model,
                messages: [
                  { role: 'system', content: 'Kamu adalah asisten AI yang membantu identifikasi obat. Jawab HANYA dengan teks deskripsi, tanpa kata lain.' },
                  { role: 'user', content: prompt }
                ],
                temperature: 0,
                max_tokens: 300,
              },
              {
                headers: {
                  'Authorization': `Bearer ${key}`,
                  'Content-Type': 'application/json',
                },
                timeout: 15000,
              }
            );

            const aiText = data?.choices?.[0]?.message?.content?.trim();
            if (aiText) {
              return res.json({ description: aiText, source: 'ai' });
            }
          } catch (e) {
            lastError = e;
          }
        }
      }

      return res.json({ description: knowledgeDescription || '', source: lastError ? 'knowledge' : 'knowledge' });
    } catch (error) {
      console.error('Error calling AI:', error);
      res.json({ description: knowledgeDescription || '', source: 'knowledge' });
    }
    }
  );

  app.delete(
    '/api/products/:id',
    authenticate,
    checkPermission('Management Product', 'delete'),
    async (req, res) => {
    const id = parseInt(req.params.id);

    try {
      const connection = await pool.getConnection();

      const [rows] = await connection.query(
        'SELECT id, name FROM products WHERE id = ?',
        [id]
      );
      if (rows.length === 0) {
        connection.release();
        return res.status(404).json({ message: 'Product not found' });
      }

      const productName = rows[0].name;

      await connection.query('UPDATE products SET is_active = 0 WHERE id = ?', [id]);

      connection.release();

      await createAuditTrail({
        user_id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        module: 'Management Product',
        action: 'delete',
        description: `Menghapus produk: ${productName}`,
      });

      res.json({ message: 'Product deactivated successfully' });
    } catch (error) {
      console.error('Error deleting product:', error);
      res.status(500).json({ message: 'Server error' });
    }
    }
  );

  app.delete(
    '/api/products/:id/permanent',
    authenticate,
    checkPermission('Management Product', 'delete'),
    async (req, res) => {
    const id = parseInt(req.params.id);

    try {
      const [rows] = await pool.query('SELECT id, name FROM products WHERE id = ?', [id]);
      if (rows.length === 0) {
        return res.status(404).json({ message: 'Produk tidak ditemukan' });
      }

      const productName = rows[0].name;

      await pool.query('DELETE FROM products WHERE id = ?', [id]);

      await createAuditTrail({
        user_id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        module: 'Management Product',
        action: 'delete_permanent',
        description: `Menghapus permanen produk: ${productName}`,
      });

      res.json({ message: `Produk "${productName}" berhasil dihapus permanen` });
    } catch (error) {
      if (error && error.code === 'ER_ROW_IS_REFERENCED_2') {
        return res.status(400).json({
          message: 'Produk tidak dapat dihapus permanen karena masih memiliki riwayat transaksi. Nonaktifkan saja produk ini.'
        });
      }
      console.error('Error permanently deleting product:', error);
      res.status(500).json({ message: 'Server error' });
    }
    }
  );

  app.post(
    '/api/inventory/adjust',
    authenticate,
    checkPermission('Management Product', 'edit'),
    async (req, res) => {
      const { productId, type, quantity, note } = req.body;

      if (!productId || !type || !quantity) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        const [products] = await connection.query(
          'SELECT stock FROM products WHERE id = ?',
          [productId]
        );
        if (products.length === 0) {
          connection.release();
          return res.status(404).json({ message: 'Product not found' });
        }
        const currentStock = products[0].stock;
        let newStock = currentStock;
        let change = 0;

        if (type === 'add') {
          newStock += quantity;
          change = quantity;
        } else if (type === 'reduce') {
          if (currentStock < quantity) {
            connection.release();
            return res.status(400).json({ message: 'Insufficient stock' });
          }
          newStock -= quantity;
          change = -quantity;
        } else {
          connection.release();
          return res.status(400).json({ message: 'Invalid adjustment type' });
        }

        await connection.query('UPDATE products SET stock = ? WHERE id = ?', [
          newStock,
          productId,
        ]);

        await connection.query(
          'INSERT INTO inventory_history (product_id, type, quantity_change, previous_stock, new_stock, note, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            productId,
            'adjustment',
            change,
            currentStock,
            newStock,
            note || 'Manual Adjustment',
            req.user.id,
          ]
        );

        await connection.commit();
        res.json({ message: 'Stock adjusted successfully', newStock });
      } catch (error) {
        await connection.rollback();
        console.error('Error adjusting stock:', error);
        res.status(500).json({ message: 'Server error' });
      } finally {
        connection.release();
      }
    }
  );

  app.post(
    '/api/stock-opname',
    authenticate,
    checkPermission('Stock Opname', 'create'),
    async (req, res) => {
    const { items, note } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ message: 'Invalid items data' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const today = new Date().toISOString().split('T')[0];

      // Create stock opname session
      const changedItems = items.filter(item => item.actual_stock !== item.system_stock);
      const [sessionResult] = await connection.query(
        'INSERT INTO stock_opname_sessions (date, user_id, total_items) VALUES (?, ?, ?)',
        [today, req.user.id, changedItems.length]
      );
      const sessionId = sessionResult.insertId;

      for (const item of items) {
        const { id, system_stock, actual_stock } = item;
        const difference = actual_stock - system_stock;

        if (difference !== 0) {
          await connection.query('UPDATE products SET stock = ? WHERE id = ?', [
            actual_stock,
            id,
          ]);

          // Get product cost price, product_category, and name
          const [productResult] = await connection.query('SELECT cost_price, product_category, name FROM products WHERE id = ?', [id]);
          const costPrice = productResult[0]?.cost_price || 0;
          const isObat = productResult[0]?.product_category === 'OBAT';
          const persediaanCode = isObat ? '103' : '104';
          const productName = productResult[0]?.name || `Produk #${id}`;
          const differenceValue = difference * costPrice;

          // Create journal entry
          const journalItems = [];
          if (difference > 0) {
            // Stock increased: Debit Persediaan (Obat/Non-Obat), Credit Pendapatan Selisih Stok (404)
            journalItems.push(
              { accountCode: persediaanCode, debit: differenceValue },
              { accountCode: '404', credit: differenceValue }
            );
          } else {
            // Stock decreased: Debit Beban Selisih Stok (527), Credit Persediaan (Obat/Non-Obat)
            const absValue = Math.abs(differenceValue);
            journalItems.push(
              { accountCode: '527', debit: absValue },
              { accountCode: persediaanCode, credit: absValue }
            );
          }

          await createJournalEntry(connection, null, today, 
            `Penyesuaian stok opname: ${productName} (${difference > 0 ? '+' : ''}${difference} pcs)`,
            journalItems
          );

          await connection.query(
            'INSERT INTO inventory_history (product_id, type, quantity_change, previous_stock, new_stock, note, user_id, session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
              id,
              'opname',
              difference,
              system_stock,
              actual_stock,
              note || 'Stock Opname Adjustment',
              req.user.id,
              sessionId,
            ]
          );
        }
      }

      await connection.commit();
      res.json({ message: 'Stock Opname completed successfully', sessionId });
    } catch (error) {
      await connection.rollback();
      console.error('Error processing Stock Opname:', error);
      res.status(500).json({ message: 'Server error' });
    } finally {
      connection.release();
    }
    }
  );

  // GET /api/stock-opname/sessions - Get all stock opname sessions
  app.get(
    '/api/stock-opname/sessions',
    authenticate,
    checkPermission('Stock Opname', 'show'),
    async (req, res) => {
    try {
      const [sessions] = await pool.query(`
        SELECT s.*, u.username
        FROM stock_opname_sessions s
        LEFT JOIN users u ON s.user_id = u.id
        ORDER BY s.created_at DESC
      `);
      res.json({ data: sessions });
    } catch (error) {
      console.error('Error fetching opname sessions:', error);
      res.status(500).json({ message: 'Server error' });
    }
    }
  );

  // GET /api/products/:id/opname-history - Get product-specific opname records
  app.get(
    '/api/products/:id/opname-history',
    authenticate,
    checkPermission('Stock Opname', 'show'),
    async (req, res) => {
    const { id } = req.params;
    try {
      const [records] = await pool.query(`
        SELECT ih.*, sos.date, u.username
        FROM inventory_history ih
        LEFT JOIN stock_opname_sessions sos ON ih.session_id = sos.id
        LEFT JOIN users u ON sos.user_id = u.id
        WHERE ih.product_id = ? AND ih.type = 'opname'
        ORDER BY ih.created_at DESC
      `, [id]);

      const [product] = await pool.query('SELECT name, unit FROM products WHERE id = ?', [id]);

      res.json({
        records,
        product: product[0] || null
      });
    } catch (error) {
      console.error('Error fetching product opname history:', error);
      res.status(500).json({ message: 'Server error' });
    }
    }
  );

  // GET /api/stock-opname/sessions/:id - Get session detail (products counted)
  app.get(
    '/api/stock-opname/sessions/:id',
    authenticate,
    checkPermission('Stock Opname', 'show'),
    async (req, res) => {
    const { id } = req.params;
    try {
      const [session] = await pool.query(`
        SELECT s.*, u.username
        FROM stock_opname_sessions s
        LEFT JOIN users u ON s.user_id = u.id
        WHERE s.id = ?
      `, [id]);

      if (session.length === 0) {
        return res.status(404).json({ message: 'Session not found' });
      }

      const [items] = await pool.query(`
        SELECT ih.*, p.name AS product_name, p.unit
        FROM inventory_history ih
        LEFT JOIN products p ON ih.product_id = p.id
        WHERE ih.session_id = ? AND ih.type = 'opname'
        ORDER BY p.name ASC
      `, [id]);

      res.json({ session: session[0], items });
    } catch (error) {
      console.error('Error fetching session detail:', error);
      res.status(500).json({ message: 'Server error' });
    }
    }
  );
};
