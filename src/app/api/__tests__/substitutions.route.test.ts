import { POST } from "../substitutions/route";

jest.mock("@google/genai", () => {
  class GoogleGenAI {
    models: { generateContent: jest.Mock };
    constructor() {
      this.models = {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({
            recommendations: [
              { name: "Kool Fever" },
              { name: "Panadol" },
              { name: "Paracetamol" },
              { name: "Ibuprofen" },
              { name: "Tempra" },
            ],
            advice: "test",
            sources: [],
          }),
        }),
      };
    }
  }
  return { GoogleGenAI };
});

describe("api/substitutions", () => {
  test("POST validates empty message", async () => {
    const req = {
      json: async () => ({ message: "" }),
      headers: { get: () => null },
    } as any;

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test("POST returns recommendations json", async () => {
    const req = {
      json: async () => ({ message: "bye bye fever", apiKey: "dummy" }),
      headers: { get: () => null },
    } as any;

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.recommendations)).toBe(true);
  });
});

