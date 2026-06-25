const mysql = require('mysql2/promise');
const axios = require('axios');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const MODELS = [
  'openai/gpt-4o-mini',
  'openai/gpt-4o',
  'deepseek/deepseek-chat-v3-0324',
  'meta-llama/llama-3.3-70b-instruct',
];

async function callAI(productName) {
  const keys = [
    process.env.OPEN_ROUTER_API_1,
    process.env.OPEN_ROUTER_API_2,
    process.env.OPEN_ROUTER_API_3,
    process.env.OPEN_ROUTER_API_4,
  ].filter(Boolean);

  const prompt = [
    'Produk: "' + productName + '"',
    '',
    'Tugas: Jelaskan secara singkat obat ini digunakan untuk apa (indikasi).',
    'Jika tidak tahu, jawab "Tidak ada informasi".',
    '',
    'Format jawaban HANYA teks deskripsi saja, tanpa kata lain, tanpa label.',
  ].join('\n');

  for (const key of keys) {
    for (const model of MODELS) {
      try {
        const { data } = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
          model,
          messages: [
            { role: 'system', content: 'Kamu adalah asisten AI yang membantu identifikasi obat. Jawab HANYA dengan teks deskripsi, tanpa kata lain.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0,
          max_tokens: 200,
        }, {
          headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
          timeout: 20000,
        });
        const text = data?.choices?.[0]?.message?.content?.trim();
        if (text) return text;
      } catch (e) {
        // try next
      }
    }
  }
  return null;
}

(async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'skripsi',
  });

  const [products] = await pool.query(
    "SELECT id, name FROM products WHERE is_active = 1 AND (description IS NULL OR description = '') ORDER BY id ASC LIMIT 25"
  );

  console.log('Found ' + products.length + ' products without descriptions\n');

  for (const p of products) {
    process.stdout.write('[' + p.id + '] ' + p.name + '... ');
    const desc = await callAI(p.name);
    if (desc) {
      await pool.query('UPDATE products SET description = ? WHERE id = ?', [desc, p.id]);
      console.log('OK: ' + desc.substring(0, 80));
    } else {
      console.log('FAILED (AI error)');
    }
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('\nDone!');
  await pool.end();
})();
