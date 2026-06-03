
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const OPENROUTER_MODELS = [
  'google/gemini-2.0-flash-001',
  'google/gemini-3.1-flash-lite',
];

async function callOpenRouter(promptJson, instruction) {
  const OPENROUTER_API_KEY = process.env.OPEN_ROUTER_API;

  if (!OPENROUTER_API_KEY) {
    throw new Error('OPEN_ROUTER_API tidak ditemukan di .env');
  }

  for (let i = 0; i < OPENROUTER_MODELS.length; i++) {
    const model = OPENROUTER_MODELS[i];
    try {
      console.log(`[OpenRouter] Trying model: ${model}...`);

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'http://localhost:3000',
          'X-OpenRouter-Title': 'Sales Point POS',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: instruction,
            },
            {
              role: 'user',
              content: JSON.stringify(promptJson, null, 2),
            },
          ],
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[OpenRouter] Model ${model} gagal:`, errorText);
        continue;
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      console.log('[OpenRouter] Response:', content);
      return {
        content: content,
        model: model,
        usage: data.usage,
      };
    } catch (error) {
      console.warn(`[OpenRouter] Model ${model} error:`, error.message);
      continue;
    }
  }

  throw new Error('Semua model OpenRouter gagal');
}

function extractJson(text) {
  if (typeof text !== 'string') return null;

  let t = text.trim();
  if (!t) return null;

  const match1 = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match1 && match1[1]) {
    t = match1[1].trim();
  }

  try {
    return JSON.parse(t);
  } catch {
    const idx1 = t.indexOf('{');
    const idx2 = t.lastIndexOf('}');
    if (idx1 !== -1 && idx2 !== -1 && idx2 > idx1) {
      const s = t.slice(idx1, idx2 + 1);
      try {
        return JSON.parse(s);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function validateOutput(obj, context) {
  if (!obj || typeof obj !== 'object') {
    return { valid: false, reason: 'bukan_object', result: null };
  }

  let tambahan = null;
  if (Number.isFinite(obj.tambahan_stok)) tambahan = obj.tambahan_stok;
  else if (Number.isFinite(obj.tambahan)) tambahan = obj.tambahan;
  else if (Number.isFinite(obj.stock)) tambahan = obj.stock;
  else if (Number.isFinite(obj.stok)) tambahan = obj.stok;
  else if (Number.isFinite(obj.quantity)) tambahan = obj.quantity;
  else if (Number.isFinite(obj.qty)) tambahan = obj.qty;
  else if (Number.isFinite(obj.value)) tambahan = obj.value;
  else if (Number.isFinite(obj.result)) tambahan = obj.result;

  if (!Number.isFinite(tambahan)) {
    if (Number.isFinite(obj)) {
      tambahan = obj;
    }
  }

  if (!Number.isFinite(tambahan)) {
    const numbers = [];
    const words = (JSON.stringify(obj) + ' ' + (context?.text || '')).split(/\D+/).map(Number).filter(n => Number.isFinite(n) && n >= 0);
    if (words.length > 0) {
      const avg = words.reduce((a, b) => a + b, 0) / words.length;
      const selected = words.find(n => n <= avg * 2 && n >= 0);
      if (Number.isFinite(selected)) {
        tambahan = selected;
      } else {
        tambahan = words[0];
      }
    }
  }

  if (!Number.isFinite(tambahan)) {
    const text = context?.text || '';
    const patterns = [
      /tambahan.*?[:=]\s*(\d+)/i,
      /stok.*?[:=]\s*(\d+)/i,
      /tambahan_stok.*?[:=]\s*(\d+)/i,
      /tambahan\s+(\d+)/i,
      /stok\s+(\d+)/i,
      /quantity\s*[:=]\s*(\d+)/i,
      /qty\s*[:=]\s*(\d+)/i,
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m && m[1]) {
        const n = Number(m[1]);
        if (Number.isFinite(n)) {
          tambahan = n;
          break;
        }
      }
    }
  }

  if (!Number.isFinite(tambahan)) {
    return { valid: false, reason: 'no_quantity', result: null };
  }

  tambahan = Math.round(tambahan);
  tambahan = Math.max(0, tambahan);

  const stokSaatIni = Number(context?.stok_saat_ini || 0);
  const kebutuhan7Estimasi = stokSaatIni + tambahan;
  obj.tambahan_stok = tambahan;

  if (tambahan > 0) {
    const avgWeekly = Number(context?.avg_weekly_sales || 0);
    if (avgWeekly > 0 && tambahan > avgWeekly * 10 && tambahan > 100) {
      return { valid: false, reason: 'threshold_anomaly', result: { tambahan_stok: tambahan } };
    }
  }

  return { valid: true, reason: null, result: { tambahan_stok: tambahan, kebutuhan_7_hari: kebutuhan7Estimasi } };
}

function fallbackExponentialSmoothing(series, alpha = 0.3) {
  if (!Array.isArray(series) || series.length === 0) return 0;
  let smoothed = series[0] || 0;
  for (let i = 1; i < series.length; i++) {
    const val = series[i];
    if (Number.isFinite(val) && val >= 0) {
      smoothed = alpha * val + (1 - alpha) * smoothed;
    }
  }
  return smoothed;
}

function createSlidingWindow(series, windowSize = 7) {
  const w = Number.isFinite(windowSize) ? windowSize : 7;
  if (!Array.isArray(series) || series.length < w + 1) return [];
  const dataset = [];
  for (let i = 0; i + w < series.length; i += 1) {
    dataset.push({
      input: series.slice(i, i + w),
      output: series[i + w],
    });
  }
  return dataset;
}

function buildGeminiPrompt(product, datasetWindowed, leadTime = 7) {
  const promptJson = {
    task: 'peramalan_stok_obat_apotek',
    produk: {
      id: product.id,
      nama: product.nama,
      stok_saat_ini: product.stok_saat_ini,
      satuan_terkecil: product.satuan_terkecil,
      punya_satuan_besar: !!product.punya_satuan_besar,
      satuan_besar: product.satuan_besar || null,
      jumlah_per_satuan_besar: product.jumlah_per_satuan_besar || null,
      dataset_windowed: datasetWindowed,
    },
    lead_time: leadTime,
    format_jawaban: { tambahan_stok: 'integer' },
  };
  return promptJson;
}

async function generateStockRecommendation(options) {
  const product = options.product;
  const series = options.series || [];
  const windowSize = options.windowSize || 7;
  const leadTime = options.leadTime || 7;
  const datasetWindowed = createSlidingWindow(series, windowSize);
  const stokSaatIni = Number(product.stok_saat_ini || 0);
  const perDayBaseline = fallbackExponentialSmoothing(series, 0.2);
  const weeklyBaseline = Math.max(0, Math.round(perDayBaseline * 7));
  const baselineTambahan = Math.max(0, Math.round(weeklyBaseline - stokSaatIni));

  let metode = 'fallback';
  let alasanFallback = null;
  let hasilTambahanStok = baselineTambahan;
  let kebutuhan7Hari = stokSaatIni + baselineTambahan;
  let perkiraanPerHari = perDayBaseline;
  let debugInfo = null;

  if (datasetWindowed.length >= 5) {
    try {
      const promptJson = buildGeminiPrompt(product, datasetWindowed, leadTime);
      const instruction =
        'Tugas: Melakukan peramalan kebutuhan stok obat untuk 7 hari ke depan berdasarkan pola penjualan pada dataset_windowed.\n' +
        'Gunakan data historis untuk memperkirakan kebutuhan_7_hari, kemudian hitung tambahan stok dengan rumus berikut:\n' +
        'tambahan = max(0, kebutuhan_7_hari - stok_saat_ini)\n' +
        'Jika punya_satuan_besar = true, maka tambahan harus dibulatkan ke kelipatan jumlah_per_satuan_besar.\n' +
        'Output harus dalam format JSON.\n\n' +
        'Few-Shot Examples\n' +
        'Contoh berikut menunjukkan cara menghitung tambahan stok.\n' +
        'Contoh 1\n' +
        'Input:\n' +
        'stok_saat_ini = 5\n' +
        'kebutuhan_7_hari = 22\n' +
        'punya_satuan_besar = true\n' +
        'jumlah_per_satuan_besar = 10\n' +
        'Output:\n' +
        '{\n  "tambahan_stok": 20\n}\n\n' +
        'Contoh 2\n' +
        'Input:\n' +
        'stok_saat_ini = 12\n' +
        'kebutuhan_7_hari = 18\n' +
        'punya_satuan_besar = true\n' +
        'jumlah_per_satuan_besar = 10\n' +
        'Output:\n' +
        '{\n  "tambahan_stok": 10\n}\n\n' +
        'Kasus yang Harus Diprediksi\n' +
        'Parameter:\n' +
        'stok_saat_ini = ' + promptJson.produk.stok_saat_ini + '\n' +
        'lead_time = ' + leadTime + ' hari\n' +
        'punya_satuan_besar = ' + (!!promptJson.produk.punya_satuan_besar) + '\n' +
        'Dataset historis:\n' +
        'dataset_windowed:\n' +
        JSON.stringify(datasetWindowed, null, 2) + '\n\n' +
        'TUGAS PENTING: HANYA KELUARKAN JSON SAJA, TANPA KATA-KATA LAIN!\n' +
        'Contoh output yang benar:\n' +
        '{"tambahan_stok": 15}\n';

      const response = await callOpenRouter(promptJson, instruction);
      const parsed = extractJson(response.content);
      const avgWeeklySales = series.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0) / (series.length / 7);

      const validation = validateOutput(parsed, {
        text: response.content,
        stok_saat_ini: stokSaatIni,
        avg_weekly_sales: avgWeeklySales,
      });

      if (validation.valid) {
        metode = 'gemini';
        hasilTambahanStok = validation.result.tambahan_stok;
        kebutuhan7Hari = validation.result.kebutuhan_7_hari;
        debugInfo = {
          prompt_gemini: JSON.stringify(promptJson, null, 2) + '\n\n' + instruction,
          response_gemini: response.content,
        };
      } else {
        metode = 'fallback';
        alasanFallback = validation.reason || 'invalid_output';
        if (validation.result && Number.isFinite(validation.result.tambahan_stok)) {
          hasilTambahanStok = validation.result.tambahan_stok;
          kebutuhan7Hari = stokSaatIni + hasilTambahanStok;
        }
        debugInfo = {
          prompt_gemini: JSON.stringify(promptJson, null, 2) + '\n\n' + instruction,
          response_gemini: response.content,
        };
      }
    } catch (err) {
      metode = 'fallback';
      alasanFallback = 'api_error';
    }
  } else {
    alasanFallback = 'insufficient_data';
  }

  return {
    metode,
    alasan_fallback: alasanFallback,
    rekomendasi: {
      tambahan_stok: hasilTambahanStok,
      satuan: product.satuan_terkecil,
    },
    kebutuhan_7_hari: kebutuhan7Hari,
    perkiraan_penjualan_per_hari: perkiraanPerHari,
    debug: debugInfo,
  };
}

const sampleSeries = [3, 1, 0, 1, 4, 0, 3, 2, 1, 0, 1, 4, 0, 3, 2, 1, 0, 1, 1, 2, 3, 0, 1, 4, 1, 3, 5, 5, 3, 0, 2, 2, 2, 3, 2, 1, 3, 2, 1, 2, 1, 4, 2, 2, 3, 2, 1, 1, 3, 2, 2, 2, 1, 2, 1, 1, 4, 2, 2, 3, 2, 1, 1];

async function main() {
  console.log('========== Stock Forecast dengan OpenRouter ==========');
  console.log('Sample series:', sampleSeries);
  console.log('Jumlah data:', sampleSeries.length);

  try {
    const result = await generateStockRecommendation({
      product: {
        id: 'P001',
        nama: 'Paracetamol',
        stok_saat_ini: 2,
        satuan_terkecil: 'tablet',
        punya_satuan_besar: false,
        satuan_besar: null,
        jumlah_per_satuan_besar: null,
      },
      series: sampleSeries,
      windowSize: 7,
      leadTime: 7,
    });

    console.log('\n========== HASIL PERAMALAN ==========');
    console.log('Metode:', result.metode);
    if (result.alasan_fallback) {
      console.log('Alasan fallback:', result.alasan_fallback);
    }
    console.log('Rekomendasi tambahan stok:', result.rekomendasi.tambahan_stok, result.rekomendasi.satuan);
    console.log('Kebutuhan 7 hari:', result.kebutuhan_7_hari);
    console.log('Perkiraan per hari:', result.perkiraan_penjualan_per_hari);

    if (result.debug) {
      console.log('\n========== DEBUG INFO ==========');
      console.log('Prompt Gemini:', result.debug.prompt_gemini);
      console.log('Response Gemini:', result.debug.response_gemini);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
