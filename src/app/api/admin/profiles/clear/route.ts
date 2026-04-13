import { NextRequest, NextResponse } from "next/server";
import { verifyAdminKey } from "@/lib/admin-auth";
import db from "@/lib/db";

const deleteAll = db.prepare("DELETE FROM profiles");
const countAll = db.prepare("SELECT COUNT(*) as count FROM profiles");

export async function DELETE(req: NextRequest) {
  const authError = verifyAdminKey(req);
  if (authError) return authError;

  const { count } = countAll.get() as { count: number };
  deleteAll.run();

  return NextResponse.json({ deleted: count });
}
