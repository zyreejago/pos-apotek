import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

function readDataset(): string[] {
  const filePath = path.join(process.cwd(), "knowledge.csv");
  if (!fs.existsSync(filePath)) return [];
  const fileContent = fs.readFileSync(filePath, "utf-8");
  return fileContent
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function extractUrl(line: string): string | undefined {
  const match = line.match(/https?:[^\s,\"]+/i);
  return match ? match[0] : undefined;
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

function shouldExcludeRecommendation(recName: string, inputNameRaw: string): boolean {
  const inputNorm = normalizeName(inputNameRaw);
  if (!inputNorm || inputNorm.length < 4) return false;
  const recNorm = normalizeName(recName);
  return recNorm.includes(inputNorm);
}

function buildSourceMap(lines: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const l of lines) {
    const name = l.split(",")[0]?.trim();
    if (!name) continue;
    const url = extractUrl(l);
    if (url) map.set(normalizeName(name), url);
  }
  return map;
}

function getRelevantContext(dataset: string[], query: string, maxChars: number = 50000): string {
  if (!query) return dataset.slice(0, 20).join("\n");

  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  
  // If no specific terms (e.g. very short query), return a subset
  if (terms.length === 0) return dataset.slice(0, 50).join("\n");

  // Score each line
  const scored = dataset.map(line => {
    const lower = line.toLowerCase();
    let score = 0;
    // Boost for exact phrase match
    if (lower.includes(query)) score += 100;
    
    // Score for individual terms
    for (const term of terms) {
      if (lower.includes(term)) score += 10;
    }
    return { line, score };
  });

  // Sort by score desc
  scored.sort((a, b) => b.score - a.score);

  // Filter matches with score > 0
  const matches = scored.filter(s => s.score > 0);

  let selected = matches.length > 0 ? matches : scored.slice(0, 50);
  
  // Limit by size
  let currentChars = 0;
  const resultLines: string[] = [];
  
  for (const item of selected) {
    if (currentChars + item.line.length > maxChars) break;
    resultLines.push(item.line);
    currentChars += item.line.length;
  }
  
  if (resultLines.length === 0 && dataset.length > 0) {
      return dataset.slice(0, 20).join("\n");
  }

  return resultLines.join("\n");
}

function buildPrompt(inputUser: string, context: string) {
  return (
    "Anda adalah asisten apotek cerdas di Indonesia. Input user: '" +
    inputUser +
    "'.\n\n" +
    "TUGAS:\n" +
    "Berikan rekomendasi obat/produk pengganti (substitusi) yang sesuai.\n\n" +
    "SUMBER DATA:\n" +
    "1. PRIORITASKAN data dari DATASET berikut:\n" +
    context +
    "\n\n" +
    "2. ATURAN PENGGUNAAN DATASET vs UMUM:\n" +
    "   - PRIORITASKAN data dari DATASET HANYA JIKA RELEVAN (kandungan/indikasi sama dan bisa menggantikan).\n" +
    "   - JANGAN MEMAKSAKAN mengambil dari dataset jika tidak ada yang cocok secara medis (misal: beda fungsi total).\n" +
    "   - Jika di dataset TIDAK ADA pengganti yang layak, ABAIKAN dataset dan gunakan PENGETAHUAN UMUM SEPENUHNYA.\n" +
    "   - JIKA hasil dari dataset relevan tapi kurang dari 5, tambahkan dari PENGETAHUAN UMUM hingga total 5.\n" +
    "   - Rekomendasi pengetahuan umum harus valid dan tersedia di Indonesia.\n" +
    "   - JANGAN berikan sumber URL untuk rekomendasi tambahan ini (biarkan kosong).\n\n" +
    "STRATEGI PENCARIAN CERDAS:\n" +
    "- Analisis kolom 'composition' untuk menemukan obat dengan kandungan aktif yang sama (misal: paracetamol = acetaminophen).\n" +
    "- Analisis kolom 'description' untuk menemukan obat dengan indikasi/kegunaan yang sama (misal: obat demam, obat batuk).\n" +
    "- Jangan hanya melihat kesamaan nama produk. Pahami konteks medisnya.\n\n" +
    "ATURAN KRUSIAL:\n" +
    "1. EKSKLUSI INPUT: Jangan pernah merekomendasikan produk yang SAMA dengan input user. \n" +
    "   - Contoh: Jika input 'Bye Bye Fever' (atau typo 'baby fiver'), JANGAN sertakan varian 'Bye Bye Fever' apapun dalam rekomendasi. Cari merek LAIN seperti 'Koolfever', dll.\n" +
    "2. Jika rekomendasi diambil dari DATASET, gunakan nama persis seperti di dataset.\n" +
    "3. Jika rekomendasi dari PENGETAHUAN UMUM (luar dataset), gunakan nama produk umum yang valid.\n" +
    "4. Format Output JSON (tanpa markdown):\n" +
    "{\n  \"recommendations\": [ { \"name\": string } ],\n  \"advice\": string,\n  \"sources\": [string]\n}\n" +
    "5. Target: TOTAL MINIMAL 5 REKOMENDASI (Dataset + Umum).\n"
  );
}

function extractJson(input: string): any | null {
  if (!input) return null;
  let s = input.trim();
  s = s.replace(/```json/gi, "");
  s = s.replace(/```/g, "");
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) s = s.slice(start, end + 1);
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3-flash",
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message: unknown = body?.message;
    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Keluhan tidak valid" }, { status: 400 });
    }

    const allLines = readDataset();
    const header = allLines.length > 0 ? allLines[0] : "";
    const dataLines = allLines.length > 1 ? allLines.slice(1) : [];
    
    const query = message.trim().toLowerCase();
    const sourceMap = buildSourceMap(dataLines);

    const apiKeyFromBody = typeof body?.apiKey === "string" ? body.apiKey : undefined;
    const headerKey = req.headers.get("x-api-key") || undefined;
    
    const availableKeys = [
      apiKeyFromBody,
      headerKey,
      process.env.GOOGLE_API_KEY,
      process.env.GOOGLE_API_KEY_2
    ].filter(Boolean) as string[]; 

    const uniqueKeys = Array.from(new Set(availableKeys));

    if (uniqueKeys.length === 0) {
      return NextResponse.json(
        { error: "API key tidak tersedia. Kirim via header 'x-api-key' atau body 'apiKey'" },
        { status: 500 }
      );
    }

  
    const contextBody = getRelevantContext(dataLines, query, 100000);
    const context = header + "\n" + contextBody;
    
    const prompt = buildPrompt(message, context);

    let responseText: string | null = null;
    let lastError = null;

    for (const currentKey of uniqueKeys) {
      console.log(`Using API Key: ...${currentKey.slice(-4)}`);
      const ai = new GoogleGenAI({ apiKey: currentKey });

      // Inner loop: Iterate through Models
      for (const modelName of MODELS) {
        try {
          console.log(`Trying model: ${modelName}`);
          
          const config: any = {};
          if (modelName === "gemini-2.5-flash") {
            config.thinkingConfig = { thinkingBudget: 2 };
          }
  
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config,
          });
  
          if (response && response.text) {
            responseText = response.text;
            console.log(`Model ${modelName} succeeded with key ...${currentKey.slice(-4)}`);
            break; // Break inner loop (models)
          }
        } catch (e: any) {
          console.error(`Model ${modelName} failed with key ...${currentKey.slice(-4)}:`, e);
          lastError = e;
          // Continue to next model
        }
      }

      if (responseText) {
        break; // Break outer loop (keys) if success
      }
      
      console.warn(`All models failed for key ...${currentKey.slice(-4)}. Switching to next key if available.`);
    }

    if (!responseText) {
       console.error("All AI models failed. Fallback to local search.");
       // Fallback: simple keyword search from dataset
       // Use getRelevantContext logic but format as recommendations
       // Since getRelevantContext returns a string, we need to parse lines again or just reuse logic
       // Actually getRelevantContext returns the most relevant lines. We can just package them.
       
       // Re-fetch context but maybe with more lenient limit for fallback display
       const fallbackLines = getRelevantContext(dataLines, query, 5000).split("\n");
      const fallbackRecs = fallbackLines
        .map(l => {
          const name = l.split(",")[0]?.trim();
          return name ? { name } : null;
        })
        .filter(Boolean);

      // Deduplicate
      const filteredRecs = (fallbackRecs as any[]).filter(r => !shouldExcludeRecommendation(String(r.name || ""), message));
      const uniqueRecs = Array.from(new Map(filteredRecs.map((r: any) => [r.name, r])).values()).slice(0, 5);

       const enriched = uniqueRecs.map((r: any) => {
          const name = String(r?.name || "");
          const src = sourceMap.get(normalizeName(name));
          return { name, source: src };
        });

       return NextResponse.json({ 
         recommendations: enriched, 
         advice: "Maaf, koneksi AI sedang sibuk. Berikut adalah hasil pencarian dari database lokal.", 
         sources: [] 
       });
    }

    const parsed = extractJson(responseText || "");
    
    const raw = parsed && (Array.isArray(parsed.recommendations) || parsed.advice)
      ? { recommendations: parsed.recommendations || [], advice: parsed.advice || "", sources: parsed.sources || [] }
      : { recommendations: [], advice: "Tidak ada hasil valid dari AI", sources: [] };

    // We rely on the AI to exclude the input product name as per instructions.
    // We do NOT filter by string inclusion here to avoid blocking valid symptom-based results (e.g. "Demam" -> "Obat Demam").
    const filtered = (raw.recommendations as any[]).filter(r => !shouldExcludeRecommendation(String(r?.name || ""), message));
    const enriched = filtered.map((r: any) => {
      const name = String(r?.name || "");
      const src = sourceMap.get(normalizeName(name));
      return { name, source: src };
    });

    return NextResponse.json({ ...raw, recommendations: enriched });

  } catch (error) {
    console.error("Global Error:", error);
    return NextResponse.json({ error: "Gagal memproses permintaan" }, { status: 500 });
  }
}
