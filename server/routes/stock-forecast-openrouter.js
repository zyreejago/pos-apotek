
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const OPENROUTER_MODELS = [
  'google/gemini-2.0-flash-001',
  'google/gemini-2.5-flash',
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-pro",
  "google/gemini-3.1-flash-lite-preview",

  'google/gemini-2.5-flash-lite',
];

async function processBatch(items, batchSize, processFn) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    console.log(`Memproses batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)} (${batch.length} produk)`);
    const batchResults = await Promise.all(batch.map(processFn));
    results.push(...batchResults);
  }
  return results;
}

function imputeMissingValues(series) {
  if (!Array.isArray(series) || series.length === 0) return [];

  const result = [...series];

  for (let i = 0; i < result.length; i++) {
    if (result[i] !== null && Number.isFinite(result[i])) continue;

    let left = null;
    for (let j = i - 1; j >= 0; j--) {
      if (Number.isFinite(result[j])) {
        left = result[j];
        break;
      }
    }

    let right = null;
    for (let j = i + 1; j < result.length; j++) {
      if (Number.isFinite(result[j])) {
        right = result[j];
        break;
      }
    }

    let imputed = 0;

    if (left !== null && right !== null) {
      const trend = (right - left) / 2;
      imputed = left + trend;
    } else if (left !== null) {
      imputed = left;
    } else if (right !== null) {
      imputed = right;
    }

    result[i] = Math.max(0, Math.round(imputed));
  }

  return result;
}

function normalizeAnomalies(series, windowSize = 7) {
  if (!Array.isArray(series) || series.length < windowSize) return series;

  const result = [...series];
  const w = windowSize;

  for (let i = 0; i < result.length; i++) {
    const val = result[i];
    if (!Number.isFinite(val)) continue;

    const start = Math.max(0, i - w);
    const end = Math.min(result.length, i + w + 1);

    const window = result.slice(start, end)
      .filter(v => Number.isFinite(v));

    if (window.length < 3) continue;

    const sorted = [...window].sort((a, b) => a - b);

    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;

    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;

    if (val < lower || val > upper) {
      const median = sorted[Math.floor(sorted.length / 2)];
      result[i] = median;
    }
  }

  return result;
}

function prepareTimeSeries(rows, options = {}) {
  const days = Number.isFinite(options.days) ? options.days : 365;
  
  let endDate;
  if (options.endDate) {
    endDate = new Date(options.endDate);
  } else if (rows && rows.length > 0) {
    const dates = rows.map(r => new Date(r.day)).filter(d => !isNaN(d.getTime()));
    if (dates.length > 0) {
      endDate = new Date(Math.max(...dates));
    } else {
      endDate = new Date();
    }
  } else {
    endDate = new Date();
  }
  
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (days - 1));

  const byDay = new Map();
  for (const r of rows || []) {
    const day = r?.day ? new Date(r.day) : null;
    if (!day || Number.isNaN(day.getTime())) continue;
    const key = day.toISOString().slice(0, 10);
    const qty = Number(r?.qty || 0);
    byDay.set(key, (byDay.get(key) || 0) + (Number.isFinite(qty) ? qty : 0));
  }

  let series = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const raw = byDay.get(key);
    series.push(raw !== undefined ? raw : null);
  }

  series = imputeMissingValues(series);
  series = normalizeAnomalies(series, 7);

  return { series, startDate, endDate };
}

function createSlidingWindow(series, windowSize = 7, forecastHorizon = 7) {
  const w = Number.isFinite(windowSize) ? windowSize : 7;
  const fh = Number.isFinite(forecastHorizon) ? forecastHorizon : 7;
  if (!Array.isArray(series) || series.length < w + fh) return [];
  const dataset = [];
  
  for (let i = 0; i + w + fh <= series.length; i++) {
    const input = series.slice(i, i + w);
    const output = series
      .slice(i + w, i + w + fh)
      .reduce((a, b) => a + b, 0);
    
    dataset.push({ input, output });
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

async function callOpenRouter(promptJson, instruction) {
  const apiKeys = [
    process.env.OPEN_ROUTER_API,
    process.env.OPEN_ROUTER_API_1,
    process.env.OPEN_ROUTER_API_2,
    process.env.OPEN_ROUTER_API_3,
    process.env.OPEN_ROUTER_API_4,

    
  ].filter(Boolean);

  if (apiKeys.length === 0) {
    const err = new Error('Missing OPEN_ROUTER_API');
    err.code = 'MISSING_OPENROUTER_API_KEY';
    throw err;
  }

  console.log('========== PROMPT YANG DIKIRIM KE OPENROUTER ==========');
  console.log(instruction);
  console.log('=====================================================');

  let lastError = null;
  for (const apiKey of apiKeys) {
    for (const model of OPENROUTER_MODELS) {
      console.log(`[OpenRouter] Trying API key ${apiKeys.indexOf(apiKey) + 1} with model: ${model}...`);
      
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': 'http://localhost:3000',
            'X-OpenRouter-Title': 'Sales Point POS',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: 'system',
                content: 'Kamu adalah asisten AI yang membantu peramalan stok obat di apotek. Jawaban kamu HANYA JSON saja, tanpa kata-kata lain!',
              },
              {
                role: 'user',
                content: instruction,
              },
            ],
            temperature: 0,
            max_tokens: 64,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`[OpenRouter] API key ${apiKeys.indexOf(apiKey) + 1}, Model ${model} gagal:`, errorText);
          lastError = new Error(errorText);
          continue;
        }

        const data = await response.json();
        console.log('FULL OPENROUTER RESPONSE'); 
        console.log(JSON.stringify(data, null, 2));

        const aiText = data.choices[0].message.content;
        
        console.log('========== RESPONSE DARI OPENROUTER ==========');
        console.log(aiText);
        console.log('============================================');
        
        return { instruction, aiText, model: model, usage: data.usage };
      } catch (e) {
        console.warn(`[OpenRouter] API key ${apiKeys.indexOf(apiKey) + 1}, Model ${model} error:`, e.message);
        lastError = e;
      }
    }
  }

  const err = new Error('OpenRouter error');
  err.code = lastError?.code || 'openrouter_error';
  throw err;
}

function computeWeeklyStats(series, windowSize = 7) {
  const w = Number.isFinite(windowSize) ? windowSize : 7;
  if (!Array.isArray(series) || series.length < w) return { weeklySums: [], mean: 0, std: 0 };

  const weeklySums = [];
  for (let i = 0; i + w <= series.length; i += 1) {
    const sum = series.slice(i, i + w).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
    weeklySums.push(sum);
  }

  const mean = weeklySums.reduce((a, b) => a + b, 0) / weeklySums.length;
  const variance =
    weeklySums.reduce((acc, x) => acc + Math.pow(x - mean, 2), 0) / (weeklySums.length || 1);
  const std = Math.sqrt(variance);
  return { weeklySums, mean, std };
}

function computeTrendDirection(series) {
  if (!Array.isArray(series) || series.length < 2) return 0;
  const n = series.length;
  const recent1 = series[n - 1];
  const recent2 = series[n - 2];
  const change = recent1 - recent2;
  return change > 0 ? 1 : change < 0 ? -1 : 0;
}

function extractJson(text) { 
  if (!text) return null; 

  try { 
    let clean = text.trim(); 

    clean = clean
      .replace(/```(?:json|javascript|js)?\s*/gi, '')
      .replace(/```/g, '')
      .trim();

    let jsonStr = null;
    
    const jsonMatch = clean.match(/^\{[\s\S]*\}$/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    if (!jsonStr) {
      const start = clean.indexOf('{');
      const end = clean.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        jsonStr = clean.slice(start, end + 1);
      }
    }

    if (!jsonStr) {
      return null;
    }

    jsonStr = jsonStr
      .replace(/\n/g, ' ')
      .replace(/\r/g, '')
      .replace(/\t/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const parsed = JSON.parse(jsonStr); 

    if (parsed && typeof parsed === 'object') {
      const result = {};
      
      if (parsed.kebutuhan_7_hari !== undefined && parsed.kebutuhan_7_hari !== null) {
        let k7 = parsed.kebutuhan_7_hari;
        if (typeof k7 === 'string') {
          k7 = parseInt(k7.replace(/[^\d]/g, ''), 10);
        }
        if (typeof k7 === 'number' && !isNaN(k7) && isFinite(k7)) {
          result.kebutuhan_7_hari = Math.max(0, Math.round(k7));
        }
      }
      
      const possibleKeys = ['tambahan_stok', 'tambahan', 'stock', 'stok', 'quantity', 'qty', 'value', 'result'];
      for (const key of possibleKeys) {
        if (parsed[key] !== undefined && parsed[key] !== null) {
          let val = parsed[key];
          if (typeof val === 'string') {
            val = parseInt(val.replace(/[^\d]/g, ''), 10);
          }
          if (typeof val === 'number' && !isNaN(val) && isFinite(val)) {
            result.tambahan_stok = Math.max(0, Math.round(val));
            break;
          }
        }
      }
      
      if (result.tambahan_stok !== undefined) {
        return result;
      }
    } 

    return null; 
  } catch (err) { 
    console.log('extractJson error:', err.message); 
    // AGRESIF: jika semua gagal, cari SEMUA angka di teks dan ambil yang masuk akal!
    const numbers = text.match(/\d+/g);
    if (numbers && numbers.length > 0) {
      // Ambil angka pertama yang >0 (atau 0 jika semua nol)
      let fallbackNumber = parseInt(numbers[0], 10);
      for (const numStr of numbers) {
        const num = parseInt(numStr, 10);
        if (num > 0 && num < 1000) {
          fallbackNumber = num;
          break;
        }
      }
      console.log('🔥 AGRESIF EXTRACT: Menggunakan angka fallback:', fallbackNumber);
      return { tambahan_stok: Math.max(0, fallbackNumber) };
    }
    return null; 
  } 
}

function validateOutput(aiText, context) {
  console.log('RAW OPENROUTER RESPONSE:'); 
  console.log(JSON.stringify(aiText, null, 2));
  console.log('========== VALIDATE OUTPUT ==========');
  console.log('Input aiText:', JSON.stringify(aiText));
  
  let obj = null;
  
  try {
    const parsed = JSON.parse(aiText);
    console.log('✓ Direct JSON parse berhasil:', parsed);
    
    if (typeof parsed === 'number') {
      obj = { tambahan_stok: parsed };
    } else if (parsed && typeof parsed === 'object') {
      obj = parsed;
    }
  } catch {
    console.log('✗ Direct JSON parse gagal');
  }

  if (!obj) {
    console.log('→ Coba extractJson...');
    obj = extractJson(aiText);
    if (obj) console.log('✓ extractJson berhasil:', obj);
  }

  if (!obj) {
    console.log('→ Coba cari angka dengan konteks...');
    const patterns = [
      /tambahan.*?(\d+)/i,
      /stok.*?(\d+)/i,
      /stock.*?(\d+)/i,
      /quantity.*?(\d+)/i,
      /jumlah.*?(\d+)/i,
      /kebutuhan.*?(\d+)/i,
      /adalah.*?(\d+)/i,
      /:.*?(\d+)/,
      /=.*?(\d+)/,
    ];
    
    for (const pattern of patterns) {
      const match = aiText.match(pattern);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && isFinite(num) && num >= 0) {
          obj = { tambahan_stok: num };
          console.log('✓ Cari angka dengan konteks berhasil:', obj);
          break;
        }
      }
    }
  }

  if (!obj) {
    console.log('→ Coba ambil semua angka dari response...');
    const numbers = aiText.match(/\d+/g);
    if (numbers && numbers.length > 0) {
      const parsedNumbers = numbers.map(n => parseInt(n, 10)).filter(n => !isNaN(n) && isFinite(n) && n >= 0);
      
      if (parsedNumbers.length > 0) {
        parsedNumbers.sort((a, b) => a - b);
        
        for (const num of parsedNumbers) {
          if (num <= 10000) {
            obj = { tambahan_stok: num };
            console.log('✓ Ambil angka berhasil:', obj);
            break;
          }
        }
        
        if (!obj) {
          obj = { tambahan_stok: parsedNumbers[0] };
          console.log('✓ Ambil angka pertama berhasil:', obj);
        }
      }
    }
  }

  if (!obj) {
    console.log('✗ SEMUA METODE GAGAL, return format_invalid');
    return { ok: false, reason: 'format_invalid' };
  }

  let tambahan = obj?.tambahan_stok;
  if (tambahan === undefined || tambahan === null) {
    tambahan = obj?.tambahan;
  }
  if (tambahan === undefined || tambahan === null) {
    tambahan = obj?.stock;
  }
  if (tambahan === undefined || tambahan === null) {
    const keys = Object.keys(obj);
    for (const k of keys) {
      const v = obj[k];
      if (typeof v === 'number' && Number.isFinite(v)) {
        tambahan = v;
        break;
      }
      if (typeof v === 'string') {
        const num = parseInt(v, 10);
        if (!isNaN(num)) {
          tambahan = num;
          break;
        }
      }
    }
  }

  if (tambahan === undefined || tambahan === null) {
    return { ok: false, reason: 'numeric_invalid' };
  }

  if (typeof tambahan === 'string') {
    tambahan = parseInt(tambahan, 10);
    if (isNaN(tambahan)) {
      return { ok: false, reason: 'numeric_invalid' };
    }
  }

  if (!Number.isFinite(tambahan)) {
    return { ok: false, reason: 'numeric_invalid' };
  }

  tambahan = Math.round(tambahan);
  tambahan = Math.max(0, tambahan);

  const stokSaatIni = Number(context?.stok_saat_ini || 0);

  let kebutuhan7Hari = 
    obj.kebutuhan_7_hari !== undefined 
      ? Number(obj.kebutuhan_7_hari) 
      : stokSaatIni + tambahan;

  if (!Number.isFinite(kebutuhan7Hari)) { 
    kebutuhan7Hari = stokSaatIni + tambahan;
  }

  kebutuhan7Hari = Math.max(0, Math.round(kebutuhan7Hari));
  obj.tambahan_stok = tambahan;

  const stats = computeWeeklyStats(context?.series || [], context?.windowSize || 7);
  const weeklyMean = stats.mean;
  
  const threshold150Percent = weeklyMean * 1.5;
  const threshold2Std = weeklyMean + 2 * stats.std;
  const upperForecast = Math.max(threshold150Percent, threshold2Std);
  
  console.log('Validasi threshold sesuai dokumen:');
  console.log('- stok_saat_ini:', stokSaatIni);
  console.log('- tambahan_stok:', tambahan);
  console.log('- kebutuhan_7_hari:', kebutuhan7Hari);
  console.log('- weeklyMean:', weeklyMean);
  console.log('- threshold150Percent:', threshold150Percent);
  console.log('- threshold2Std:', threshold2Std);
  console.log('- upperForecast:', upperForecast);

  const series = context?.series || [];
  if (series.length >= 14) {
    const sum = (arr) => arr.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);

    const prevWeek = sum(series.slice(-14, -7));
    const lastWeek = sum(series.slice(-7));

    const actualTrendSign = Math.sign(lastWeek - prevWeek);

    const predictedValue = kebutuhan7Hari;
    const predictedTrendSign = Math.sign(predictedValue - lastWeek);

    console.log('MDA/sign mingguan sesuai konsep:');
    console.log('- prevWeek:', prevWeek);
    console.log('- lastWeek:', lastWeek);
    console.log('- actualTrendSign:', actualTrendSign);
    console.log('- predictedValue:', predictedValue);
    console.log('- predictedTrendSign:', predictedTrendSign);

    const tolerance = Math.max(2, lastWeek * 0.2);

    if (
      actualTrendSign !== 0 &&
      predictedTrendSign !== 0 &&
      actualTrendSign !== predictedTrendSign &&
      Math.abs(predictedValue - lastWeek) > tolerance
    ) {
      console.log('✗ Deteksi Halusinasi Tren: arah mingguan tidak konsisten');
      return { ok: false, reason: 'trend_hallucination' };
    }
  }

  if (weeklyMean > 0 && kebutuhan7Hari > upperForecast) {
    console.log('✗ Threshold Checking: kebutuhan_7_hari diluar batas historis');
    return { ok: false, reason: 'threshold_anomaly' };
  }

  const result = { ok: true, parsed: { tambahan_stok: tambahan, kebutuhan_7_hari: kebutuhan7Hari } };
  console.log('✓ Validasi BERHASIL! Result:', result);
  console.log('====================================');
  return result;
}

function fallbackExponentialSmoothing(series, alpha = 0.2) {
  if (!Array.isArray(series) || series.length === 0) return 0;
  const a = Number.isFinite(alpha) ? alpha : 0.2;
  let forecast = Number.isFinite(series[0]) ? series[0] : 0;
  for (let i = 1; i < series.length; i += 1) {
    const actualPrev = Number.isFinite(series[i - 1]) ? series[i - 1] : 0;
    forecast = a * actualPrev + (1 - a) * forecast;
  }

  const lastActual = Number.isFinite(series[series.length - 1]) ? series[series.length - 1] : 0;
  const nextForecast = a * lastActual + (1 - a) * forecast;
  return Math.max(0, nextForecast);
}

function roundUpToMultiple(value, multiple) {
  const v = Math.max(0, Math.ceil(value));
  const m = Math.max(0, Math.floor(multiple));
  if (!m) return v;
  return Math.ceil(v / m) * m;
}

async function generateStockRecommendation(options) {
  const leadTime = Number.isFinite(options.leadTime) ? options.leadTime : 7;
  const windowSize = Number.isFinite(options.windowSize) ? options.windowSize : 7;

  const series = options.series || [];
  const datasetWindowed = createSlidingWindow(series, windowSize);

  const stokSaatIni = Number(options.product.stok_saat_ini || 0);
  const perDayBaseline = fallbackExponentialSmoothing(series, 0.2);
  const recentDays = series.slice(Math.max(0, series.length - 30));
  const recentSold = recentDays.reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0);
  const totalSold = series.reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0);

  let method = 'gemini';
  let tambahanStok = 0;
  let kebutuhan7 = Math.max(0, Math.round(perDayBaseline * leadTime));
  let perkiraanPerHari = 0;
  let validationReason = null;
  let geminiPrompt = null;
  let geminiResponse = null;
  if (kebutuhan7 === 0 && recentSold > 0) kebutuhan7 = 1;

  try {
    const promptJson = buildGeminiPrompt(
      {
        id: options.product.id,
        nama: options.product.nama,
        stok_saat_ini: options.product.stok_saat_ini,
        satuan_terkecil: options.product.satuan_terkecil,
        punya_satuan_besar: options.product.punya_satuan_besar,
        satuan_besar: options.product.satuan_besar,
        jumlah_per_satuan_besar: options.product.jumlah_per_satuan_besar,
      },
      datasetWindowed,
      leadTime
    );

    const instruction =
      'Anda adalah sistem AI peramalan stok obat apotek.\n\n' +
      'Tugas:\n' +
      'Estimasi kebutuhan stok 7 hari ke depan berdasarkan pola historis pada dataset_windowed, lalu hitung tambahan stok yang perlu dipesan.\n\n' +
      'PENTING: Di dataset_windowed, setiap contoh memiliki:\n' +
      '- input = 7 hari penjualan historis\n' +
      '- output = TOTAL PENJUALAN 7 HARI BERIKUTNYA (bukan 1 hari saja)\n\n' +
      'ATURAN FORECASTING:\n' +
      '- Gunakan pola historis untuk memperkirakan kebutuhan_7_hari (total 7 hari ke depan).\n' +
      '- Prioritaskan kestabilan prediksi dibanding nilai ekstrem.\n' +
      '- Data terbaru lebih penting dibanding data lama.\n' +
      '- Jangan menghasilkan prediksi tidak wajar dibanding historis.\n\n' +
      'RUMUS:\n' +
      'tambahan_stok = max(0, kebutuhan_7_hari - stok_saat_ini)\n\n' +
      'ATURAN SATUAN:\n' +
      'Jika punya_satuan_besar = true:\n' +
      '- tambahan_stok wajib dibulatkan KE ATAS ke kelipatan jumlah_per_satuan_besar.\n\n' +
      'VALIDASI INTERNAL:\n' +
      '1. kebutuhan_7_hari harus integer positif.\n' +
      '2. tambahan_stok harus integer >= 0.\n' +
      '3. Jika punya_satuan_besar = true: tambahan_stok harus habis dibagi jumlah_per_satuan_besar.\n\n' +
      'ANTI-HALUSINASI:\n' +
      '- Jangan membuat angka acak.\n' +
      '- Jangan memberi penjelasan.\n' +
      '- Jangan menambahkan teks selain output.\n' +
      '- Gunakan hanya data yang diberikan.\n\n' +
      'PARAMETER:\n' +
      'stok_saat_ini = ' + promptJson.produk.stok_saat_ini + '\n' +
      'lead_time = ' + leadTime + '\n' +
      'punya_satuan_besar = ' + promptJson.produk.punya_satuan_besar + '\n' +
      (promptJson.produk.jumlah_per_satuan_besar ? 'jumlah_per_satuan_besar = ' + promptJson.produk.jumlah_per_satuan_besar + '\n' : '') +
      '\n' +
      'dataset_windowed:\n' +
      JSON.stringify(promptJson.produk.dataset_windowed) + '\n\n' +
      'FORMAT OUTPUT WAJIB (HARUS KEDUA ANGKA):\n' +
      '{\n' +
      '  "kebutuhan_7_hari": <integer>,\n' +
      '  "tambahan_stok": <integer>\n' +
      '}\n\n' +
      'Tidak boleh ada teks lain selain JSON.';

    const geminiResult = await callOpenRouter(promptJson, instruction);
    geminiPrompt = geminiResult.instruction;
    geminiResponse = geminiResult.aiText;
    
    const validation = validateOutput(geminiResult.aiText, {
      series,
      windowSize,
      stok_saat_ini: stokSaatIni,
    });

    if (!validation.ok) {
      method = 'fallback';
      validationReason = validation.reason;
      
      // fallback memakai ES 
      perkiraanPerHari = perDayBaseline;
      
    } else {
      // Gunakan kebutuhan_7_hari dari Gemini jika tersedia
      if (validation.parsed.kebutuhan_7_hari !== undefined && validation.parsed.kebutuhan_7_hari !== null) {
        kebutuhan7 = Math.max(0, Math.round(validation.parsed.kebutuhan_7_hari));
      } else if (validation.parsed.tambahan_stok !== undefined) {
        kebutuhan7 = stokSaatIni + validation.parsed.tambahan_stok;
      }
      
      // Hitung tambahan_stok dari kebutuhan_7_hari
      tambahanStok = Math.max(0, kebutuhan7 - stokSaatIni);
      
      if (validation.parsed.tambahan_stok !== undefined && validation.parsed.tambahan_stok !== null) {
        tambahanStok = Math.max(0, Math.round(validation.parsed.tambahan_stok));
      }

      // Gemini valid → estimasi harian dari hasil Gemini 
      perkiraanPerHari = kebutuhan7 / leadTime;
    }
  } catch (e) {
    method = 'fallback';
    validationReason = e?.code || 'openrouter_error';
    
    // fallback memakai ES 
    perkiraanPerHari = perDayBaseline;
  }

  if (method === 'fallback') {
    if (!validationReason && totalSold === 0) validationReason = 'no_sales_data';

    tambahanStok = Math.max(0, kebutuhan7 - stokSaatIni);
    
    // fallback memakai ES 
    perkiraanPerHari = perDayBaseline;
  }

  const punyaSatuanBesar = !!options.product.punya_satuan_besar;
  const jumlahPer = Number(options.product.jumlah_per_satuan_besar || 0);
  const roundedTambahan = punyaSatuanBesar ? roundUpToMultiple(tambahanStok, jumlahPer) : tambahanStok;

  const result = {
    metode: method,
    alasan_fallback: validationReason,
    produk: {
      id: options.product.id,
      nama: options.product.nama,
      stok_saat_ini: options.product.stok_saat_ini,
      satuan_terkecil: options.product.satuan_terkecil,
      punya_satuan_besar: punyaSatuanBesar,
      satuan_besar: options.product.satuan_besar || null,
      jumlah_per_satuan_besar: punyaSatuanBesar ? jumlahPer : null,
    },
    lead_time: leadTime,
    rekomendasi: {
      kebutuhan_7_hari: kebutuhan7,
      perkiraan_penjualan_per_hari: perkiraanPerHari,
      tambahan_stok: roundedTambahan,
      satuan: options.product.satuan_terkecil,
      tambahan_dalam_satuan_besar:
        punyaSatuanBesar && jumlahPer ? Math.ceil(roundedTambahan / jumlahPer) : null,
      satuan_besar: punyaSatuanBesar ? options.product.satuan_besar : null,
    },
    debug: {
      prompt_gemini: geminiPrompt,
      response_gemini: geminiResponse
    }
  };

  console.log('========== DEBUG INFO ==========');
  console.log('Prompt OpenRouter:', geminiPrompt);
  console.log('Response OpenRouter:', geminiResponse);
  console.log('Final Result:', JSON.stringify(result, null, 2));
  console.log('================================');

  return result;
}

function normalizeDrugName(input) {
  return (input || '')
    .toString()
    .replace(/\t/g, ' ')
    .replace(/\u00a0/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function loadMonthlySalesFromXlsx(filePath) {
  const startDate = new Date('2025-01-01');
  const endDate = new Date('2025-12-31');
  
  if (!filePath) return { salesByName: new Map(), startDate, endDate };
  if (!fs.existsSync(filePath)) return { salesByName: new Map(), startDate, endDate };

  const wb = XLSX.readFile(filePath);
  const salesByName = new Map();

  for (const sheetName of wb.SheetNames) {
    if (sheetName.toLowerCase() === 'supplier') continue;
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!Array.isArray(rows) || rows.length < 4) continue;

    const header = rows[2] || [];
    const dateCols = [];
    for (let c = 0; c < header.length; c += 1) {
      const v = header[c];
      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())) {
        dateCols.push({ c, date: v.trim() });
      }
    }

    for (let r = 3; r < rows.length; r += 1) {
      const row = rows[r] || [];
      const rawName = row[1];
      const name = normalizeDrugName(rawName);
      if (!name) continue;

      let dayMap = salesByName.get(name);
      if (!dayMap) {
        dayMap = new Map();
        salesByName.set(name, dayMap);
      }

      for (const dc of dateCols) {
        const cell = row[dc.c];
        let n = null;
        if (typeof cell === 'number') {
          n = cell;
        } else if (typeof cell === 'string' && cell.trim() !== '') {
          const cleaned = cell.replace(/\./g, '').replace(',', '.');
          const parsed = Number(cleaned);
          if (Number.isFinite(parsed)) {
            n = parsed;
          }
        }
        if (n !== null && n >= 0) {
          dayMap.set(dc.date, (dayMap.get(dc.date) || 0) + n);
        }
      }
    }
  }

  return { salesByName, startDate, endDate };
}

function buildDailySeriesFromDayMap(dayMap, startDate, endDate) {
  let series = [];
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    const raw = dayMap?.get(key);
    series.push(raw !== undefined ? raw : null);
  }

  series = imputeMissingValues(series);
  series = normalizeAnomalies(series, 7);

  return series;
}

function getDayMapRange(dayMap) {
  if (!dayMap || dayMap.size === 0) return { min: null, max: null };
  let min = null;
  let max = null;
  for (const k of dayMap.keys()) {
    const d = new Date(k);
    if (Number.isNaN(d.getTime())) continue;
    if (!min || d < min) min = d;
    if (!max || d > max) max = d;
  }
  return { min, max };
}

function diffDaysInclusive(min, max) {
  if (!min || !max) return 0;
  const ms = max.getTime() - min.getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
}

async function runWeeklyForecastJob(pool, options = {}) {
  const leadTime = Number.isFinite(options.leadTime) ? options.leadTime : 7;
  const windowSize = Number.isFinite(options.windowSize) ? options.windowSize : 7;

  const [products] = await pool.query('SELECT id, name, stock, unit FROM products WHERE is_active = 1 ORDER BY id ASC');

  const now = new Date();
  const jobKey = 'weekly_stock_forecast';
  await pool.query(
    'INSERT INTO forecast_jobs (job_key, last_run_at, last_status, last_error) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE last_run_at = VALUES(last_run_at), last_status = VALUES(last_status), last_error = VALUES(last_error)',
    [jobKey, now, 'running', null]
  );

  const processProduct = async (p) => {
    const [salesRows] = await pool.query(
      `SELECT sale_date AS day, quantity AS qty FROM sales_history WHERE product_id = ? ORDER BY sale_date ASC`,
      [p.id]
    );
    const [transactionRows] = await pool.query(
      `SELECT DATE(t.transaction_date) AS day, SUM(ti.quantity) AS qty
       FROM transaction_items ti
       JOIN transactions t ON ti.transaction_id = t.id
       WHERE ti.product_id = ? AND t.payment_status = 'completed'
       GROUP BY DATE(t.transaction_date)
       ORDER BY day ASC`,
      [p.id]
    );
    const allRows = [...salesRows, ...transactionRows];
    // Calculate actual date range from data, minimum 365 days
    let dataDays = 365;
    if (allRows.length > 0) {
      const dates = allRows.map(r => new Date(r.day)).filter(d => !isNaN(d.getTime()));
      if (dates.length > 0) {
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        const range = Math.round((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1;
        dataDays = Math.max(range, 365);
      }
    }
    const { series, startDate, endDate } = prepareTimeSeries(allRows, { days: dataDays });
    const sourceEndDate = endDate ? endDate.toISOString().slice(0, 10) : null;

    const rec = await generateStockRecommendation({
      series,
      leadTime,
      windowSize,
      product: {
        id: `P${String(p.id).padStart(3, '0')}`,
        nama: p.name,
        stok_saat_ini: Number(p.stock || 0),
        satuan_terkecil: p.unit || 'pcs',
        punya_satuan_besar: false,
        satuan_besar: null,
        jumlah_per_satuan_besar: null,
      },
    });

    return { p, rec, sourceEndDate };
  };

  const results = await processBatch(products || [], 10, processProduct);

  for (const { p, rec, sourceEndDate } of results) {
    await pool.query(
      `INSERT INTO stock_forecasts
        (product_id, source, source_end_date, lead_time, window_size, metode, alasan_fallback, kebutuhan_7_hari, perkiraan_penjualan_per_hari, tambahan_stok, satuan, debug_prompt, debug_response)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        p.id,
        'sales_history+transactions',
        sourceEndDate,
        leadTime,
        windowSize,
        rec.metode,
        rec.alasan_fallback,
        rec.rekomendasi.kebutuhan_7_hari || 0,
        rec.rekomendasi.perkiraan_penjualan_per_hari || 0,
        rec.rekomendasi.tambahan_stok || 0,
        rec.rekomendasi.satuan || p.unit || null,
        rec.debug?.prompt_gemini || null,
        rec.debug?.response_gemini || null,
      ]
    );
  }

  await pool.query(
    'INSERT INTO forecast_jobs (job_key, last_run_at, last_status, last_error) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE last_run_at = VALUES(last_run_at), last_status = VALUES(last_status), last_error = VALUES(last_error)',
    [jobKey, now, 'success', null]
  );

  return { ok: true, source: 'sales_history+transactions', sourceEndDate: null, productsCount: (products || []).length };
}

function startWeeklyForecastScheduler(pool, options = {}) {
  const intervalMs = Number.isFinite(options.intervalMs) ? options.intervalMs : 7 * 24 * 60 * 60 * 1000;
  const run = async () => {
    try {
      const [rows] = await pool.query('SELECT last_run_at FROM forecast_jobs WHERE job_key = ?', [
        'weekly_stock_forecast',
      ]);
      const lastRun = rows?.[0]?.last_run_at ? new Date(rows[0].last_run_at) : null;
      const now = new Date();
      const shouldRun = !lastRun || now.getTime() - lastRun.getTime() >= intervalMs;
      if (!shouldRun) return;
      await runWeeklyForecastJob(pool, options);
    } catch (e) {
      const now = new Date();
      await pool.query(
        'INSERT INTO forecast_jobs (job_key, last_run_at, last_status, last_error) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE last_run_at = VALUES(last_run_at), last_status = VALUES(last_status), last_error = VALUES(last_error)',
        ['weekly_stock_forecast', now, 'error', (e?.message || 'error').toString().slice(0, 255)]
      );
    }
  };

  setTimeout(run, 1500);
  setInterval(run, intervalMs);
}

module.exports = function registerStockForecastOpenRouterRoutes(app, pool, authenticate, checkPermission) {
  app.post(
    '/api/forecast-openrouter/run',
    authenticate,
    async (req, res) => {
      try {
        console.log('Starting manual forecast job with OpenRouter...');
        const result = await runWeeklyForecastJob(pool, {
          xlsxPath: path.join(__dirname, '..', '..', 'NEWWWW1.xlsx'),
          leadTime: 7,
          windowSize: 7,
        });
        console.log('Forecast job completed:', result);
        res.json({ success: true, result });
      } catch (e) {
        console.error('Run forecast error:', e);
        res.status(500).json({ message: 'Gagal menjalankan peramalan', error: e.message });
      }
    }
  );

  app.get(
    '/api/forecast-openrouter/products',
    authenticate,
    checkPermission('Peramalan Stok', 'show'),
    async (req, res) => {
      const search = (req.query.search || '').toString().trim();
      try {
        const params = [];
        let sql = 'SELECT id, name, stock, unit FROM products WHERE is_active = 1';
        if (search) {
          sql += ' AND name LIKE ?';
          params.push(`%${search}%`);
        }
        sql += ' ORDER BY name ASC LIMIT 200';
        const [rows] = await pool.query(sql, params);
        res.json(rows || []);
      } catch (e) {
        res.status(500).json({ message: 'Server error' });
      }
    }
  );

  app.get(
    '/api/forecast-openrouter/latest',
    authenticate,
    checkPermission('Peramalan Stok', 'show'),
    async (req, res) => {
      const search = (req.query.search || '').toString().trim();
      try {
        const params = [];
        let sql = `
          SELECT
            p.id,
            p.name,
            p.stock,
            p.unit,
            f.source,
            DATE_FORMAT(f.source_end_date, '%Y-%m-%d') AS source_end_date,
            f.lead_time,
            f.window_size,
            f.metode,
            f.alasan_fallback,
            f.kebutuhan_7_hari,
            f.perkiraan_penjualan_per_hari,
            f.tambahan_stok,
            f.created_at AS forecast_created_at,
            f.debug_prompt,
            f.debug_response
          FROM products p
          LEFT JOIN (
            SELECT sf.*
            FROM stock_forecasts sf
            JOIN (
              SELECT product_id, MAX(id) AS max_id
              FROM stock_forecasts
              GROUP BY product_id
            ) last ON last.product_id = sf.product_id AND last.max_id = sf.id
          ) f ON f.product_id = p.id
          WHERE p.is_active = 1
        `;
        if (search) {
          sql += ' AND p.name LIKE ?';
          params.push(`%${search}%`);
        }
        sql += ' ORDER BY p.name ASC LIMIT 500';
        const [rows] = await pool.query(sql, params);
        res.json(rows || []);
      } catch {
        res.status(500).json({ message: 'Server error' });
      }
    }
  );

  app.post(
    '/api/forecast-openrouter/stock',
    authenticate,
    checkPermission('Peramalan Stok', 'show'),
    async (req, res) => {
      const productId = Number(req.body?.product_id);

      if (!Number.isFinite(productId) || productId <= 0) {
        return res.status(400).json({ message: 'product_id wajib diisi' });
      }

      try {
        const [products] = await pool.query('SELECT id, name, stock, unit FROM products WHERE id = ?', [
          productId,
        ]);
        if (!products || products.length === 0) {
          return res.status(404).json({ message: 'Produk tidak ditemukan' });
        }

        const product = products[0];

        const [forecasts] = await pool.query(
          `SELECT * FROM stock_forecasts WHERE product_id = ? ORDER BY id DESC LIMIT 1`,
          [productId]
        );

        if (forecasts.length === 0) {
          return res.status(404).json({ message: 'Belum ada data peramalan untuk produk ini' });
        }

        const forecast = forecasts[0];

        const recommendation = {
          metode: forecast.metode,
          alasan_fallback: forecast.alasan_fallback,
          produk: {
            id: `P${String(product.id).padStart(3, '0')}`,
            nama: product.name,
            stok_saat_ini: Number(product.stock || 0),
            satuan_terkecil: product.unit || 'pcs',
            punya_satuan_besar: false,
            satuan_besar: null,
            jumlah_per_satuan_besar: null,
          },
          lead_time: forecast.lead_time,
          rekomendasi: {
            kebutuhan_7_hari: forecast.kebutuhan_7_hari,
            perkiraan_penjualan_per_hari: forecast.perkiraan_penjualan_per_hari,
            tambahan_stok: forecast.tambahan_stok,
            satuan: forecast.satuan,
            tambahan_dalam_satuan_besar: null,
            satuan_besar: null,
          },
          debug: {
            prompt_gemini: forecast.debug_prompt,
            response_gemini: forecast.debug_response,
          }
        };

        res.json(recommendation);
      } catch (e) {
        console.error('Stock debug error:', e);
        res.status(500).json({ message: 'Server error' });
      }
    }
  );
};

module.exports.prepareTimeSeries = prepareTimeSeries;
module.exports.createSlidingWindow = createSlidingWindow;
module.exports.buildGeminiPrompt = buildGeminiPrompt;
module.exports.callOpenRouter = callOpenRouter;
module.exports.extractJson = extractJson;
module.exports.validateOutput = validateOutput;
module.exports.fallbackExponentialSmoothing = fallbackExponentialSmoothing;
module.exports.generateStockRecommendation = generateStockRecommendation;
module.exports.runWeeklyForecastJob = runWeeklyForecastJob;
module.exports.startWeeklyForecastScheduler = startWeeklyForecastScheduler;

module.exports._test = {
  processBatch,
  imputeMissingValues,
  normalizeAnomalies,
  computeWeeklyStats,
  computeTrendDirection,
  roundUpToMultiple,
  normalizeDrugName,
  loadMonthlySalesFromXlsx,
  buildDailySeriesFromDayMap,
  getDayMapRange,
  diffDaysInclusive,
};
