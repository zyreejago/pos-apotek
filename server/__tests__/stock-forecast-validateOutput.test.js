const { validateOutput } = require('../routes/stock-forecast');

describe('stock forecast validateOutput', () => {
  test('detects trend hallucination when prediction contradicts weekly trend beyond tolerance', () => {
    const series = [
      1, 1, 1, 1, 1, 1, 1,
      5, 5, 5, 5, 5, 5, 5,
    ];

    const context = {
      stok_saat_ini: 0,
      series,
      windowSize: 7,
    };

    const res = validateOutput(JSON.stringify({ tambahan_stok: 0 }), context);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('trend_hallucination');
  });
});

