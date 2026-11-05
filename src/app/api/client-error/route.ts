import { NextResponse } from "next/server";

// Браузердегі күтпеген қателер Vercel логына түссін (ақ бет сияқты мәселелерді табу үшін).
export async function POST(request: Request) {
  try {
    const text = (await request.text()).slice(0, 4000);
    console.error("[client-error]", text);
  } catch {
    /* елемейміз */
  }
  return new NextResponse(null, { status: 204 });
}
