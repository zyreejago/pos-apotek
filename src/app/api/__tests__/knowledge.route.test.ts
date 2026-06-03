import { GET } from "../knowledge/route";

describe("api/knowledge", () => {
  test("GET returns data array", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });
});

