import { POST } from "../substitutions/route";
import fs from "fs";

const mockGenerateContent = jest.fn();

jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: mockGenerateContent,
    },
  })),
}));

jest.mock("fs", () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

describe("api/substitutions module", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_API_KEY_2;
  });

  test("POST validates empty message", async () => {
    const req = {
      json: async () => ({ message: "" }),
      headers: { get: () => null },
    } as any;

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test("POST validates non-string message", async () => {
    const req = {
      json: async () => ({ message: 123 }),
      headers: { get: () => null },
    } as any;

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test("POST returns error when no API keys available", async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    const req = {
      json: async () => ({ message: "test" }),
      headers: { get: () => null },
    } as any;

    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  test("POST returns fallback when all AI models fail", async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue("name,url\nKool Fever,https://example.com/koolfever\nPanadol,https://example.com/panadol");
    mockGenerateContent.mockRejectedValue(new Error("AI failed"));

    const req = {
      json: async () => ({ message: "fever", apiKey: "dummy" }),
      headers: { get: () => null },
    } as any;

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.recommendations)).toBe(true);
  });

  test("POST returns fallback when extractJson returns null", async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue("name,url\nKool Fever,https://example.com/koolfever\nPanadol,https://example.com/panadol");
    mockGenerateContent.mockResolvedValue({ text: "not valid json" });

    const req = {
      json: async () => ({ message: "fever", apiKey: "dummy" }),
      headers: { get: () => null },
    } as any;

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.advice).toContain("Tidak ada hasil valid");
  });

  test("POST uses apiKey from header", async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue("name,url\nKool Fever,https://example.com/koolfever");
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        recommendations: [{ name: "Kool Fever" }],
        advice: "test",
        sources: [],
      }),
    });

    const req = {
      json: async () => ({ message: "fever" }),
      headers: { get: (key: string) => key === "x-api-key" ? "dummy-header-key" : null },
    } as any;

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  test("POST uses environment API keys", async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue("name,url\nKool Fever,https://example.com/koolfever");
    process.env.GOOGLE_API_KEY = "env-key-1";
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        recommendations: [{ name: "Kool Fever" }],
        advice: "test",
        sources: [],
      }),
    });

    const req = {
      json: async () => ({ message: "fever" }),
      headers: { get: () => null },
    } as any;

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  test("POST tries multiple models and keys until success", async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue("name,url\nKool Fever,https://example.com/koolfever");
    process.env.GOOGLE_API_KEY = "key1";
    process.env.GOOGLE_API_KEY_2 = "key2";

    let callCount = 0;
    mockGenerateContent.mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        return Promise.reject(new Error("fail"));
      }
      return Promise.resolve({
        text: JSON.stringify({
          recommendations: [{ name: "Kool Fever" }],
          advice: "test",
          sources: [],
        }),
      });
    });

    const req = {
      json: async () => ({ message: "fever" }),
      headers: { get: () => null },
    } as any;

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  test("POST returns global error when everything fails", async () => {
    (fs.existsSync as jest.Mock).mockImplementation(() => {
      throw new Error("global fail");
    });

    const req = {
      json: async () => ({ message: "fever", apiKey: "dummy" }),
      headers: { get: () => null },
    } as any;

    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  test("POST covers getRelevantContext empty result", async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue("name,url\nKool Fever,https://example.com/koolfever\nPanadol,https://example.com/panadol");
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        recommendations: [{ name: "Test Product" }],
        advice: "test",
        sources: [],
      }),
    });
    process.env.GOOGLE_API_KEY = "env-key";

    const req = {
      json: async () => ({ message: "test query that won't match anything", apiKey: "dummy" }),
      headers: { get: () => null },
    } as any;

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  test("POST covers recommendation without source and shouldExcludeRecommendation", async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue("name,url\nKool Fever,https://example.com/koolfever\nPanadol,");
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        recommendations: [
          { name: "Kool Fever" },
          { name: "Panadol" },
          { name: "Other Product" },
        ],
        advice: "test",
        sources: [],
      }),
    });
    process.env.GOOGLE_API_KEY = "env-key";

    const req = {
      json: async () => ({ message: "Kool Fever", apiKey: "dummy" }),
      headers: { get: () => null },
    } as any;

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  test("POST covers getRelevantContext resultLines empty with non-empty dataset", async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    const longLine = "a".repeat(100001);
    (fs.readFileSync as jest.Mock).mockReturnValue(`name,url\n${longLine},https://example.com/test`);
    mockGenerateContent.mockRejectedValue(new Error("AI failed"));
    process.env.GOOGLE_API_KEY = "env-key";

    const req = {
      json: async () => ({ message: "test", apiKey: "dummy" }),
      headers: { get: () => null },
    } as any;

    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
