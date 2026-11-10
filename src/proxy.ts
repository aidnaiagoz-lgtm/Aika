import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "automax_session";
const PUBLIC_PATHS = ["/login"];
const MODE_COOKIE = "automax_mode";
// access.ts-тегі MANAGER_ALLOWED_PREFIXES-пен бірдей болуы керек
const MANAGER_ALLOWED = ["/rating", "/departments/sales/almaty", "/orders", "/change-password"];

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
    // Ескірген/жарамсыз сессия: cookie-лерді өшіріп, кіру бетін ашамыз (ERR_TOO_MANY_REDIRECTS болмасын)
    if (request.nextUrl.searchParams.has("expired")) {
      const res = NextResponse.next();
      res.cookies.delete(SESSION_COOKIE);
      res.cookies.delete(MODE_COOKIE);
      return res;
    }
    if (hasSession) {
      const home = request.cookies.get(MODE_COOKIE)?.value === "manager" ? "/rating" : "/dashboard";
      return NextResponse.redirect(new URL(home, request.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Сатушы-менеджер: тек өз беттері (клиенттік навигацияда да).
  if (request.cookies.get(MODE_COOKIE)?.value === "manager") {
    const allowed = MANAGER_ALLOWED.some((p) => pathname === p || pathname.startsWith(p + "/"));
    if (!allowed) return NextResponse.redirect(new URL("/rating", request.url));
  }

  // Layout рөлге қарай беттерді шектей алуы үшін ағымдағы жолды серверге жібереміз.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
