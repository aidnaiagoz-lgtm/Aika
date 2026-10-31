import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// §26 — Duplicate Protection: телефон енгізілген сайын клиент бар-жоғын тексеру.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ found: false }, { status: 401 });

  const phone = request.nextUrl.searchParams.get("phone")?.trim();
  if (!phone || phone.length < 6) return NextResponse.json({ found: false });

  const customer = await prisma.customer.findUnique({
    where: { phone },
    select: { id: true, fullName: true, isVip: true },
  });

  if (!customer) return NextResponse.json({ found: false });
  return NextResponse.json({ found: true, ...customer });
}
