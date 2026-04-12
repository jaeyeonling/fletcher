import { NextResponse } from "next/server";
import { validateEnv } from "@/lib/env";

export async function GET() {
  try {
    const { warnings } = validateEnv();
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
