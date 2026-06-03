import { GET } from "../knowledge/route";
import fs from "fs";

jest.mock("fs", () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

describe("api/knowledge module", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("GET returns data array when file exists", async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue("Test1\nTest2\nTest3");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual(["Test1", "Test2", "Test3"]);
  });

  test("GET returns empty array when file doesn't exist", async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  test("GET returns 500 when there's an error", async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockImplementation(() => { throw new Error("Test error"); });
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });
});
