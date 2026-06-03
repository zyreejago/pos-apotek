
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function testOpenRouter() {
  const OPENROUTER_API_KEY = process.env.OPEN_ROUTER_API;
  
  if (!OPENROUTER_API_KEY) {
    console.error('OPEN_ROUTER_API tidak ditemukan di .env');
    return;
  }

  console.log('Testing OpenRouter API...');

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-OpenRouter-Title': 'Sales Point POS',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          {
            role: 'system',
            content: 'Kamu adalah asisten AI yang membantu peramalan stok obat di apotek. Jawaban kamu HANYA JSON saja, tanpa kata-kata lain!',
          },
          {
            role: 'user',
            content: `
Tugas: Melakukan peramalan kebutuhan stok obat untuk 7 hari ke depan berdasarkan pola penjualan pada dataset_windowed.
Gunakan data historis untuk memperkirakan kebutuhan_7_hari, kemudian hitung tambahan stok dengan rumus berikut:
tambahan = max(0, kebutuhan_7_hari - stok_saat_ini)
Jika punya_satuan_besar = true, maka tambahan harus dibulatkan ke kelipatan jumlah_per_satuan_besar.
Output harus dalam format JSON.

Few-Shot Examples
Contoh berikut menunjukkan cara menghitung tambahan stok.
Contoh 1
Input:
stok_saat_ini = 5
kebutuhan_7_hari = 22
punya_satuan_besar = true
jumlah_per_satuan_besar = 10
Output:
{
  "tambahan_stok": 20
}

Contoh 2
Input:
stok_saat_ini = 12
kebutuhan_7_hari = 18
punya_satuan_besar = true
jumlah_per_satuan_besar = 10
Output:
{
  "tambahan_stok": 10
}

Kasus yang Harus Diprediksi
Parameter:
stok_saat_ini = 2
lead_time = 7 hari
punya_satuan_besar = false
Dataset historis:
dataset_windowed:
[
  {"input": [3,1,0,1,4,0,3], "output": 2},
  {"input": [1,0,1,4,0,3,2], "output": 1},
  {"input": [0,1,4,0,3,2,1], "output": 0},
  {"input": [1,4,0,3,2,1,0], "output": 1},
  {"input": [4,0,3,2,1,0,1], "output": 1},
  {"input": [0,3,2,1,0,1,1], "output": 2}
]
            `,
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return;
    }

    const data = await response.json();
    console.log('Success! Response from OpenRouter:');
    console.log(JSON.stringify(data, null, 2));

    const content = data.choices[0].message.content;
    console.log('\nContent:');
    console.log(content);

  } catch (error) {
    console.error('Error:', error);
  }
}

testOpenRouter();
