import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "knowledge.csv");
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ data: [] });
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");
    const lines = fileContent
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return NextResponse.json({ data: lines });
  } catch (error) {
    return NextResponse.json({ data: [] }, { status: 500 });
  }
}

