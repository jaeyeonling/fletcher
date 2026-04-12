import { NextRequest, NextResponse } from "next/server";
import { readdir, rm } from "fs/promises";
import path from "path";
import { verifyAdminKey } from "@/lib/admin-auth";
import { logger } from "@/lib/logger";

const PROFILES_DIR = path.join(process.cwd(), "data", "profiles");

export async function DELETE(req: NextRequest) {
  const authError = verifyAdminKey(req);
  if (authError) return authError;

  try {
    const files = await readdir(PROFILES_DIR);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    for (const file of jsonFiles) {
      await rm(path.join(PROFILES_DIR, file));
    }

    return NextResponse.json({ deleted: jsonFiles.length });
  } catch (error) {
    logger.error("Failed to clear profiles", error);
    return NextResponse.json({ deleted: 0 });
  }
}
