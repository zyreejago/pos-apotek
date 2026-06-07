jest.mock('axios', () => ({
  post: jest.fn(),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
}));

jest.mock('xlsx', () => ({
  readFile: jest.fn(),
  utils: {
    sheet_to_json: jest.fn(),
  },
}));

const express = require('express');
const request = require('supertest');

const axios = require('axios');
const fs = require('fs');
const XLSX = require('xlsx');

const stockForecastRoutes = require('../routes/stock-forecast');

function buildApp({ pool }) {
  const app = express();
  app.use(express.json());
  const authenticate = (_req, _res, next) => next();
  const checkPermission = () => (_req, _res, next) => next();
  stockForecastRoutes(app, pool, authenticate, checkPermission);
  return app;
}

describe('stock-forecast module', () => {
  let logSpy;
  let errorSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    axios.post.mockReset();
    fs.existsSync.mockReset();
    XLSX.readFile.mockReset();
    XLSX.utils.sheet_to_json.mockReset();
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_API_KEY_2;
    delete process.env.GOOGLE_API_KEY_3;
    delete process.env.GOOGLE_API_KEY_4;
    delete process.env.GOOGLE_API_KEY_5;
    delete process.env.GOOGLE_API_KEY_6;
    delete process.env.GOOGLE_API_KEY_7;
  });

  afterEach(() => {
    logSpy?.mockRestore();
    errorSpy?.mockRestore();
  });

  test('helpers cover misc paths', async () => {
    const { _test } = stockForecastRoutes;

    expect(stockForecastRoutes.imputeMissingValues(null)).toEqual([]);
    expect(stockForecastRoutes.imputeMissingValues([null, 2, null, 6])).toEqual([2, 2, 4, 6]);

    expect(stockForecastRoutes.normalizeAnomalies([1, 2], 7)).toEqual([1, 2]);
    expect(stockForecastRoutes.normalizeAnomalies([10, 10, 10, 1000, 10, 10, 10], 2)[3]).toBe(10);
    expect(stockForecastRoutes.normalizeAnomalies([NaN, 1, 2, 3], 2)).toEqual([NaN, 1, 2, 3]);
    expect(stockForecastRoutes.normalizeAnomalies([1, NaN, NaN], 1)).toEqual([1, NaN, NaN]);
    expect(stockForecastRoutes.normalizeAnomalies([10, 10, 10, 1000, 10, 10, 10])[3]).toBe(10);

    const prep = stockForecastRoutes.prepareTimeSeries(
      [
        { day: '2026-01-01', qty: 1 },
        { day: '2026-01-03', qty: 3 },
        { day: 'invalid', qty: 999 },
      ],
      { days: 3, endDate: '2026-01-03' }
    );
    expect(prep.series).toEqual([1, 2, 3]);

    const prepInvalidDates = stockForecastRoutes.prepareTimeSeries([{ day: 'bad', qty: 1 }], { days: 1 });
    expect(prepInvalidDates.series.length).toBe(1);
    const prepEmpty = stockForecastRoutes.prepareTimeSeries([], { days: 1 });
    expect(prepEmpty.series.length).toBe(1);
    expect(stockForecastRoutes.prepareTimeSeries([{ day: '2026-01-01' }]).series.length).toBe(365);
    expect(stockForecastRoutes.prepareTimeSeries(null, { days: 2, endDate: '2026-01-02' }).series).toEqual([0, 0]);

    expect(stockForecastRoutes.createSlidingWindow([1, 2, 3], 7, 7)).toEqual([]);
    expect(stockForecastRoutes.createSlidingWindow([1, 1, 1, 1], 2, 2)).toEqual([
      { input: [1, 1], output: 2 },
    ]);
    expect(stockForecastRoutes.createSlidingWindow([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1])).toEqual([
      { input: [1, 1, 1, 1, 1, 1, 1], output: 7 },
    ]);

    const prompt = stockForecastRoutes.buildGeminiPrompt(
      { id: 'P001', nama: 'A', stok_saat_ini: 1, satuan_terkecil: 'pcs', punya_satuan_besar: false },
      [{ input: [1, 2], output: 3 }],
      7
    );
    expect(prompt.produk.dataset_windowed.length).toBe(1);
    expect(stockForecastRoutes.buildGeminiPrompt({ id: 'P001', nama: 'A', stok_saat_ini: 1, satuan_terkecil: 'pcs' }, [])).toMatchObject({ lead_time: 7 });

    expect(_test.computeTrendDirection([1])).toBe(0);
    expect(_test.computeTrendDirection([1, 2])).toBe(1);
    expect(_test.computeTrendDirection([2, 1])).toBe(-1);
    expect(_test.computeTrendDirection([1, 1])).toBe(0);
    expect(_test.computeWeeklyStats([], 7)).toEqual({ weeklySums: [], mean: 0, std: 0 });

    expect(_test.roundUpToMultiple(11, 10)).toBe(20);
    expect(_test.roundUpToMultiple(11, 0)).toBe(11);

    expect(_test.normalizeDrugName('  A\tB\u00a0C  ')).toBe('a b c');

    const dayMap = new Map([
      ['2026-01-01', 1],
      ['2026-01-02', 2],
    ]);
    const range = _test.getDayMapRange(dayMap);
    expect(range.min).toBeInstanceOf(Date);
    expect(range.max).toBeInstanceOf(Date);
    expect(_test.diffDaysInclusive(range.min, range.max)).toBe(2);
    expect(_test.diffDaysInclusive(null, range.max)).toBe(0);
    expect(_test.diffDaysInclusive(new Date('2026-01-02'), new Date('2026-01-01'))).toBe(0);
    expect(_test.getDayMapRange(new Map())).toEqual({ min: null, max: null });
    const rangeInvalid = _test.getDayMapRange(new Map([['bad', 1], ['2026-01-01', 1]]));
    expect(rangeInvalid.min).toBeInstanceOf(Date);

    const daily = _test.buildDailySeriesFromDayMap(dayMap, new Date('2026-01-01'), new Date('2026-01-03'));
    expect(daily.length).toBe(3);

    const batchRes = await _test.processBatch([1, 2, 3], 2, async (x) => x * 2);
    expect(batchRes).toEqual([2, 4, 6]);
  });

  test('loadMonthlySalesFromXlsx handles missing/absent file', () => {
    fs.existsSync.mockReturnValue(false);
    const res1 = stockForecastRoutes._test.loadMonthlySalesFromXlsx();
    expect(res1.salesByName.size).toBe(0);

    const res2 = stockForecastRoutes._test.loadMonthlySalesFromXlsx('/no.xlsx');
    expect(res2.salesByName.size).toBe(0);
  });

  test('loadMonthlySalesFromXlsx parses workbook', () => {
    fs.existsSync.mockReturnValue(true);
    XLSX.readFile.mockReturnValue({
      SheetNames: ['Jan', 'Supplier', 'Feb', 'Mar', 'Short'],
      Sheets: { Jan: {}, Feb: {}, Mar: undefined, Short: {} },
    });

    XLSX.utils.sheet_to_json
      .mockReturnValueOnce([
        [],
        [],
        ['x', 'y', '2025-01-01', '2025-01-02'],
        ['a', 'Paracetamol', 1, '2'],
        ['a', '', 1, 1],
      ])
      .mockReturnValueOnce([
        [],
        [],
        ['x', 'y', '2025-02-01'],
        ['a', 'Paracetamol', '3'],
      ])
      .mockReturnValueOnce([['only1']]);

    const res = stockForecastRoutes._test.loadMonthlySalesFromXlsx('/ok.xlsx');
    expect(res.salesByName.size).toBe(1);
    const dm = res.salesByName.get('paracetamol');
    expect(dm.get('2025-01-01')).toBe(1);
    expect(dm.get('2025-01-02')).toBe(2);
    expect(dm.get('2025-02-01')).toBe(3);
  });

  test('loadMonthlySalesFromXlsx normalizes M/D/YY date format', () => {
    fs.existsSync.mockReturnValue(true);
    XLSX.readFile.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: {} },
    });
    XLSX.utils.sheet_to_json.mockReturnValueOnce([
      [],
      [],
      ['x', 'y', '1/5/25'],
      ['a', 'Paracetamol', 5],
    ]);
    const res = stockForecastRoutes._test.loadMonthlySalesFromXlsx('/ok.xlsx');
    expect(res.salesByName.get('paracetamol').get('2025-01-05')).toBe(5);
  });

  test('extractJson parses from code fences and aliases', () => {
    const obj = stockForecastRoutes.extractJson('```json\\n{ \"kebutuhan_7_hari\": \"7\", \"stok\": \"5\" }\\n```');
    expect(obj).toEqual({ kebutuhan_7_hari: 7, tambahan_stok: 5 });
  });

  test('extractJson returns null on invalid input', () => {
    expect(stockForecastRoutes.extractJson(null)).toBe(null);
    expect(stockForecastRoutes.extractJson('prefix {\"tambahan_stok\": 1} suffix')).toEqual({ tambahan_stok: 1 });
    expect(stockForecastRoutes.extractJson('{\"kebutuhan_7_hari\": 7}')).toBe(null);
    expect(stockForecastRoutes.extractJson('{\"a\":}')).toBe(null);
    expect(stockForecastRoutes.extractJson('no json here')).toBe(null);
    expect(stockForecastRoutes.extractJson('{bad')).toBe(null);
  });

  test('callGeminiAPI throws when no api keys', async () => {
    await expect(stockForecastRoutes.callGeminiAPI({}, 'x')).rejects.toMatchObject({
      code: 'MISSING_GEMINI_API_KEY',
    });
  });

  test('callGeminiAPI returns response on success', async () => {
    process.env.GEMINI_API_KEY = 'k';
    axios.post.mockResolvedValueOnce({
      data: {
        candidates: [{ content: { parts: [{ text: '{\"tambahan_stok\": 1}' }] } }],
        usageMetadata: { totalTokenCount: 1 },
      },
    });

    const res = await stockForecastRoutes.callGeminiAPI({}, 'instr');
    expect(res.aiText).toContain('tambahan_stok');
  });

  test('callGeminiAPI returns empty aiText when no parts', async () => {
    process.env.GEMINI_API_KEY = 'k';
    axios.post.mockResolvedValueOnce({
      data: {
        candidates: [{ content: { parts: [] } }],
      },
    });
    const res = await stockForecastRoutes.callGeminiAPI({}, 'instr');
    expect(res.aiText).toBe('');
  });

  test('callGeminiAPI throws after all models fail', async () => {
    process.env.GEMINI_API_KEY = 'k';
    const err = new Error('fail');
    err.code = 'E1';
    axios.post.mockRejectedValue(err);
    await expect(stockForecastRoutes.callGeminiAPI({}, 'instr')).rejects.toMatchObject({ code: 'E1' });
  });

  test('callGeminiAPI throws gemini_error when lastError has no code', async () => {
    process.env.GEMINI_API_KEY = 'k';
    axios.post.mockRejectedValue(new Error('fail'));
    await expect(stockForecastRoutes.callGeminiAPI({}, 'instr')).rejects.toMatchObject({ code: 'gemini_error' });
  });

  test('callGeminiAPI covers response/request error branches', async () => {
    process.env.GEMINI_API_KEY = 'k';
    const errResp = new Error('fail');
    errResp.code = 'E2';
    errResp.response = { status: 429, statusText: 'Too Many', data: { error: 'x' } };
    axios.post.mockRejectedValueOnce(errResp).mockRejectedValueOnce(errResp);
    await expect(stockForecastRoutes.callGeminiAPI({}, 'instr')).rejects.toMatchObject({ code: 'E2' });

    const errReq = new Error('fail');
    errReq.code = 'E3';
    errReq.request = {};
    axios.post.mockRejectedValueOnce(errReq).mockRejectedValueOnce(errReq);
    await expect(stockForecastRoutes.callGeminiAPI({}, 'instr')).rejects.toMatchObject({ code: 'E3' });
  });

  test('validateOutput covers multiple reasons', () => {
    const ctxStable = { series: Array.from({ length: 14 }, () => 10), windowSize: 7, stok_saat_ini: 0 };

    expect(stockForecastRoutes.validateOutput('5', ctxStable)).toMatchObject({ ok: true });
    expect(stockForecastRoutes.validateOutput('tambahan stok adalah 7', ctxStable)).toMatchObject({ ok: true });
    expect(stockForecastRoutes.validateOutput('```json\\n{\"tambahan_stok\":1}\\n```', ctxStable)).toMatchObject({ ok: true });
    expect(stockForecastRoutes.validateOutput('angka 12', ctxStable)).toMatchObject({ ok: true });
    expect(stockForecastRoutes.validateOutput('{"tambahan":3}', ctxStable)).toMatchObject({ ok: true });
    expect(stockForecastRoutes.validateOutput('{"stock":4}', ctxStable)).toMatchObject({ ok: true });
    expect(stockForecastRoutes.validateOutput('{"x":5}', ctxStable)).toMatchObject({ ok: true });
    expect(stockForecastRoutes.validateOutput('{"x":"6"}', ctxStable)).toMatchObject({ ok: true });
    expect(stockForecastRoutes.validateOutput('{"foo":"bar"}', ctxStable)).toEqual({ ok: false, reason: 'numeric_invalid' });
    expect(stockForecastRoutes.validateOutput('{"tambahan_stok":1e309}', ctxStable)).toEqual({ ok: false, reason: 'numeric_invalid' });
    expect(stockForecastRoutes.validateOutput('99999 88888', { series: [], windowSize: 7, stok_saat_ini: 0 })).toMatchObject({ ok: true });
    expect(stockForecastRoutes.validateOutput('{"tambahan_stok":"abc"}', ctxStable)).toEqual({ ok: false, reason: 'numeric_invalid' });
    expect(stockForecastRoutes.validateOutput('{"tambahan_stok":200}', ctxStable)).toEqual({ ok: false, reason: 'threshold_anomaly' });
    expect(stockForecastRoutes.validateOutput('{"kebutuhan_7_hari": null, "tambahan_stok": 5}', ctxStable)).toMatchObject({ ok: true });
    expect(stockForecastRoutes.validateOutput('{"kebutuhan_7_hari": "not a number", "tambahan_stok": 5}', ctxStable)).toMatchObject({ ok: true });
    expect(stockForecastRoutes.validateOutput('{"kebutuhan_7_hari": Infinity, "tambahan_stok": 5}', ctxStable)).toMatchObject({ ok: true });

    const ctxTrend = {
      series: [1, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 3, 2],
      windowSize: 7,
      stok_saat_ini: 0,
    };
    expect(stockForecastRoutes.validateOutput('{"tambahan_stok":0}', ctxTrend)).toEqual({ ok: false, reason: 'trend_hallucination' });
    expect(stockForecastRoutes.validateOutput('no numbers', ctxStable)).toEqual({ ok: false, reason: 'format_invalid' });
  });

  test('fallbackExponentialSmoothing and recommendation cover gemini and fallback', async () => {
    expect(stockForecastRoutes.fallbackExponentialSmoothing([], 0.2)).toBe(0);
    expect(stockForecastRoutes.fallbackExponentialSmoothing([NaN, 10], 0.2)).toBeGreaterThanOrEqual(0);

    const fallback = await stockForecastRoutes.generateStockRecommendation({
      series: [0, 0, 0],
      leadTime: 7,
      windowSize: 7,
      product: {
        id: 'P001',
        nama: 'A',
        stok_saat_ini: 0,
        satuan_terkecil: 'pcs',
        punya_satuan_besar: true,
        satuan_besar: 'box',
        jumlah_per_satuan_besar: 10,
      },
    });
    expect(fallback.metode).toBe('fallback');
    expect(fallback.rekomendasi.tambahan_stok % 10).toBe(0);

    const tinySales = await stockForecastRoutes.generateStockRecommendation({
      series: Array.from({ length: 30 }, () => 0).map((v, i) => (i === 29 ? 0.01 : v)),
      leadTime: 7,
      windowSize: 7,
      product: { id: 'P001', nama: 'A', stok_saat_ini: 0, satuan_terkecil: 'pcs' },
    });
    expect(tinySales.metode).toBe('fallback');
    expect(tinySales.rekomendasi.kebutuhan_7_hari).toBe(1);

    process.env.GEMINI_API_KEY = 'k';
    axios.post.mockResolvedValueOnce({
      data: {
        candidates: [{ content: { parts: [{ text: '{\"kebutuhan_7_hari\":7,\"tambahan_stok\":2}' }] } }],
      },
    });

    const gemini = await stockForecastRoutes.generateStockRecommendation({
      series: Array.from({ length: 30 }, () => 1),
      leadTime: 7,
      windowSize: 7,
      product: {
        id: 'P001',
        nama: 'A',
        stok_saat_ini: 0,
        satuan_terkecil: 'pcs',
        punya_satuan_besar: false,
        satuan_besar: null,
        jumlah_per_satuan_besar: null,
      },
    });
    expect(gemini.metode).toBe('gemini');

    axios.post.mockResolvedValueOnce({
      data: {
        candidates: [{ content: { parts: [{ text: 'no numbers' }] } }],
      },
    });

    const invalid = await stockForecastRoutes.generateStockRecommendation({
      series: Array.from({ length: 30 }, () => 1),
      leadTime: 7,
      windowSize: 7,
      product: {
        id: 'P001',
        nama: 'A',
        stok_saat_ini: 0,
        satuan_terkecil: 'pcs',
        punya_satuan_besar: false,
      },
    });
    expect(invalid.metode).toBe('fallback');
    expect(invalid.alasan_fallback).toBe('format_invalid');

    axios.post.mockRejectedValueOnce(new Error('fail'));
    const noSales = await stockForecastRoutes.generateStockRecommendation({
      series: Array.from({ length: 30 }, () => 0),
      leadTime: 7,
      windowSize: 7,
      product: { id: 'P001', nama: 'A', stok_saat_ini: 0, satuan_terkecil: 'pcs' },
    });
    expect(noSales.metode).toBe('fallback');
    expect(noSales.alasan_fallback).toBe('no_sales_data');

    axios.post.mockRejectedValueOnce(new Error('fail'));
    const hasSales = await stockForecastRoutes.generateStockRecommendation({
      series: Array.from({ length: 30 }, () => 0).map((v, i) => (i === 0 ? 1 : v)),
      leadTime: 7,
      windowSize: 7,
      product: { id: 'P001', nama: 'A', stok_saat_ini: 0, satuan_terkecil: 'pcs' },
    });
    expect(hasSales.metode).toBe('fallback');
    expect(hasSales.alasan_fallback).toBe('gemini_error');
  });

  test('routes return expected responses', async () => {
    const pool = {
      query: jest.fn()
        .mockResolvedValueOnce([[{ id: 1, name: 'Par', stock: 1, unit: 'pcs' }], []])
        .mockResolvedValueOnce([[{ id: 1, name: 'Par', stock: null, unit: null, metode: 'fallback', alasan_fallback: null, kebutuhan_7_hari: 1, perkiraan_penjualan_per_hari: 1, tambahan_stok: 0, satuan: 'pcs', debug_prompt: null, debug_response: null, lead_time: 7 }], []])
        .mockResolvedValueOnce([[{ id: 1, name: 'Par', stock: null, unit: null }], []])
        .mockResolvedValueOnce([[{ id: 1, product_id: 1, metode: 'fallback', alasan_fallback: null, kebutuhan_7_hari: 1, perkiraan_penjualan_per_hari: 1, tambahan_stok: 0, satuan: 'pcs', debug_prompt: null, debug_response: null, lead_time: 7 }], []])
        .mockResolvedValueOnce([[{ id: 1, name: 'Par', stock: 1, unit: 'pcs' }], []])
        .mockResolvedValueOnce([[{ id: 1, name: 'Par', stock: 1, unit: 'pcs', metode: 'fallback', alasan_fallback: null, kebutuhan_7_hari: 1, perkiraan_penjualan_per_hari: 1, tambahan_stok: 0, satuan: 'pcs', debug_prompt: null, debug_response: null, lead_time: 7 }], []])
        .mockResolvedValueOnce([[{ id: 1, name: 'Par', stock: 1, unit: 'pcs' }], []])
        .mockResolvedValueOnce([[{ id: 1, product_id: 1, metode: 'fallback', alasan_fallback: null, kebutuhan_7_hari: 1, perkiraan_penjualan_per_hari: 1, tambahan_stok: 0, satuan: 'pcs', debug_prompt: null, debug_response: null, lead_time: 7 }], []]),
    };

    const app = buildApp({ pool });

    const productsNoSearch = await request(app).get('/api/forecast/products');
    expect(productsNoSearch.status).toBe(200);

    const products = await request(app).get('/api/forecast/products?search=Par');
    expect(products.status).toBe(200);
    expect(Array.isArray(products.body)).toBe(true);

    const latestNoSearch = await request(app).get('/api/forecast/latest');
    expect(latestNoSearch.status).toBe(200);

    const latest = await request(app).get('/api/forecast/latest?search=Par');
    expect(latest.status).toBe(200);
    expect(Array.isArray(latest.body)).toBe(true);

    const bad = await request(app).post('/api/forecast/stock').send({ product_id: 0 });
    expect(bad.status).toBe(400);

    const okNull = await request(app).post('/api/forecast/stock').send({ product_id: 1 });
    expect(okNull.status).toBe(200);
    expect(okNull.body.produk.nama).toBe('Par');

    const ok = await request(app).post('/api/forecast/stock').send({ product_id: 1 });
    expect(ok.status).toBe(200);
    expect(ok.body.produk.nama).toBe('Par');
  });

  test('routes handle 404 and 500 branches', async () => {
    const pool404 = {
      query: jest.fn()
        .mockResolvedValueOnce([[], []]),
    };
    const app404 = buildApp({ pool: pool404 });
    const notFound = await request(app404).post('/api/forecast/stock').send({ product_id: 1 });
    expect(notFound.status).toBe(404);

    const pool500 = { query: jest.fn().mockRejectedValueOnce(new Error('db')) };
    const app500 = buildApp({ pool: pool500 });
    const err1 = await request(app500).get('/api/forecast/products');
    expect(err1.status).toBe(500);

    const poolLatest500 = { query: jest.fn().mockRejectedValueOnce(new Error('db')) };
    const appLatest500 = buildApp({ pool: poolLatest500 });
    const err2 = await request(appLatest500).get('/api/forecast/latest');
    expect(err2.status).toBe(500);

    const poolForecast404 = {
      query: jest.fn()
        .mockResolvedValueOnce([[{ id: 1, name: 'Par', stock: 1, unit: 'pcs' }], []])
        .mockResolvedValueOnce([[], []]),
    };
    const appForecast404 = buildApp({ pool: poolForecast404 });
    const missingForecast = await request(appForecast404).post('/api/forecast/stock').send({ product_id: 1 });
    expect(missingForecast.status).toBe(404);

    const poolForecast500 = {
      query: jest.fn()
        .mockResolvedValueOnce([[{ id: 1, name: 'Par', stock: 1, unit: 'pcs' }], []])
        .mockRejectedValueOnce(new Error('db')),
    };
    const appForecast500 = buildApp({ pool: poolForecast500 });
    const err3 = await request(appForecast500).post('/api/forecast/stock').send({ product_id: 1 });
    expect(err3.status).toBe(500);
  });

  test('runWeeklyForecastJob and scheduler cover branches', async () => {
    jest.useFakeTimers();

    const pool = {
      query: jest.fn()
        .mockResolvedValueOnce([[{ id: 1, name: 'Par', stock: 1, unit: 'pcs' }], []])
        .mockResolvedValueOnce([{}, []])
        .mockResolvedValueOnce([[{ day: '2026-01-01', qty: 1 }], []])
        .mockResolvedValueOnce([{}, []])
        .mockResolvedValueOnce([{}, []]),
    };

    await stockForecastRoutes.runWeeklyForecastJob(pool, { leadTime: 7, windowSize: 7 });

    const poolRunOk = {
      query: jest.fn()
        .mockResolvedValueOnce([[{ id: 1, name: 'Par', stock: 1, unit: 'pcs' }], []])
        .mockResolvedValueOnce([{}, []])
        .mockResolvedValueOnce([[{ day: '2026-01-01', qty: 1 }], []])
        .mockResolvedValueOnce([{}, []])
        .mockResolvedValueOnce([{}, []]),
    };
    const appRunOk = buildApp({ pool: poolRunOk });
    const runRes = await request(appRunOk).post('/api/forecast/run');
    expect(runRes.status).toBe(200);

    const poolRunErr = { query: jest.fn().mockRejectedValueOnce(new Error('db')) };
    const appRunErr = buildApp({ pool: poolRunErr });
    const runErrRes = await request(appRunErr).post('/api/forecast/run');
    expect(runErrRes.status).toBe(500);

    const poolSchedulerNoRun = {
      query: jest.fn().mockResolvedValueOnce([[{ last_run_at: new Date().toISOString() }], []]),
    };
    stockForecastRoutes.startWeeklyForecastScheduler(poolSchedulerNoRun, { intervalMs: 999999999 });
    jest.advanceTimersByTime(2000);

    const poolSchedulerRun = {
      query: jest.fn()
        .mockResolvedValueOnce([[{ last_run_at: new Date('2000-01-01').toISOString() }], []])
        .mockResolvedValueOnce([[{ id: 1, name: 'Par', stock: 1, unit: 'pcs' }], []])
        .mockResolvedValueOnce([{}, []])
        .mockResolvedValueOnce([[{ day: '2026-01-01', qty: 1 }], []])
        .mockResolvedValueOnce([{}, []])
        .mockResolvedValueOnce([{}, []]),
    };
    stockForecastRoutes.startWeeklyForecastScheduler(poolSchedulerRun, { intervalMs: 1 });
    jest.advanceTimersByTime(2000);

    const poolSchedulerErr = {
      query: jest.fn().mockRejectedValueOnce(new Error('db')).mockResolvedValueOnce([{}, []]),
    };
    stockForecastRoutes.startWeeklyForecastScheduler(poolSchedulerErr, { intervalMs: 1 });
    jest.advanceTimersByTime(2000);

    jest.useRealTimers();
  });
});
