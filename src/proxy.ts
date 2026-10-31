import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "automax_session";
const PUBLIC_PATHS = ["/login"];

// Жеңіл gate: тек cookie бар/жоғын тексереді. Нақты сессия/RBAC тексеруі
// (§26 талабы бойынша) әр Server Component/Server Action ішінде getSessionUser()
// арқылы орындалады — proxy-ге сенбейді.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (/\.(png|jpg|jpeg|svg|webp|ico|gif)$/.test(pathname)) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.includes(pathname)) {
    if (hasSession) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
