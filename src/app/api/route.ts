import { NextResponse } from "next/server";
import { requireAuth } from '@/lib/auth'

export async function GET() {
  const denied = await requireAuth()
  if (denied) return denied
  return NextResponse.json({ message: "Hello, world!" });
}