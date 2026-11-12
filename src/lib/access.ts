// Рөлге байланысты қарапайым тексерулер (бет деңгейі).
// Деректер деңгейіндегі нақты рұқсат — rbac.ts + domain сервистерінде.

type RoleCarrier = { userRoles: Array<{ role: { name: string } }> };

export const LEADER_ROLES = ["CEO", "ADMIN", "DEPARTMENT_HEAD"] as const;
export const MANAGER_ROLES = ["SALES_MANAGER", "SENIOR_SALES_MANAGER"] as const;
/** 2026-11-12: цехты жүргізетін адам (Бекзат) — тек «Цех» беттері. */
export const WORKSHOP_ROLES = ["WORKSHOP_HEAD"] as const;

export function hasAnyRole(user: RoleCarrier, roles: readonly string[]): boolean {
  return user.userRoles.some((ur) => roles.includes(ur.role.name));
}

/** CEO / ADMIN / РОП — менеджерлерді басқарады, барлық ақша көрсеткіштерін көреді. */
export function isLeader(user: RoleCarrier): boolean {
  return hasAnyRole(user, LEADER_ROLES);
}

/** Тек сатушы-менеджер (басшы емес) — сайттың шектеулі бөлігін ғана көреді. */
export function isSalesManagerOnly(user: RoleCarrier): boolean {
  return hasAnyRole(user, MANAGER_ROLES) && !isLeader(user);
}

/** Тек цех жауаптысы (басшы емес). */
export function isWorkshopOnly(user: RoleCarrier): boolean {
  return hasAnyRole(user, WORKSHOP_ROLES) && !isLeader(user);
}

/** Цех беттерін кім аша алады: цех жауаптысы + басшылар. */
export function canUseWorkshop(user: RoleCarrier): boolean {
  return isLeader(user) || hasAnyRole(user, WORKSHOP_ROLES);
}

/** CEO басқаратын қарапайым аккаунттар (менеджер / цех) — паролінің көшірмесі CEO-ға көрінеді. */
export function isManagedAccount(user: RoleCarrier): boolean {
  return (hasAnyRole(user, MANAGER_ROLES) || hasAnyRole(user, WORKSHOP_ROLES)) && !isLeader(user);
}

export const WORKSHOP_ALLOWED_PREFIXES = ["/workshop", "/change-password"];

export function workshopCanOpen(pathname: string): boolean {
  return WORKSHOP_ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** Менеджерге рұқсат етілген беттер (қалғаны /rating-ке бағытталады). */
// 2026-11-10: «Заказдар» менеджерлерге ашылды (рұқсат — orders VIEW/CREATE/EDIT, scope=OWN: тек өз заказдары)
export const MANAGER_ALLOWED_PREFIXES = ["/rating", "/departments/sales/almaty", "/orders", "/change-password"];

export function managerCanOpen(pathname: string): boolean {
  return MANAGER_ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/**
 * Proxy менеджерге рұқсатсыз беттерді клиенттік навигацияда да жабуы үшін логин кезінде
 * қойылатын cookie. Бұл тек UX шектеуі — деректер қауіпсіздігі RBAC (OWN scope) арқылы.
 */
export const MODE_COOKIE = "automax_mode";

/** Кіргеннен кейінгі бірінші бет. */
export function homePathFor(user: RoleCarrier): string {
  if (isWorkshopOnly(user)) return "/workshop";
  return isSalesManagerOnly(user) ? "/rating" : "/dashboard";
}

/** Логин: email немесе телефон. Телефонды тек цифрларға келтіреміз (8/7 басы → 7...). */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && (digits.startsWith("8") || digits.startsWith("7"))) return "7" + digits.slice(1);
  if (digits.length === 10) return "7" + digits;
  return null;
}

/** Ішкі логиндер үшін домен: менеджер "zere" деп жазады → zere@automax.local. */
export const LOGIN_DOMAIN = "automax.local";

/** Кіру өрісіндегі мәтін → қай пайдаланушыны іздеу керек (email / телефон / қысқа логин). */
export function loginLookup(raw: string): { email: string } | { phone: string } | null {
  const login = raw.trim().toLowerCase();
  if (!login) return null;
  if (login.includes("@")) return { email: login };
  const phone = normalizePhone(login);
  if (phone) return { phone };
  if (/^[a-z0-9._-]+$/.test(login)) return { email: `${login}@${LOGIN_DOMAIN}` };
  return null;
}

/** Пайдаланушыға көрсетілетін логин: қысқа логин / телефон / email. */
export function displayLogin(user: { email: string; phone: string | null }): string {
  if (user.email.endsWith("@" + LOGIN_DOMAIN)) {
    const local = user.email.slice(0, -(LOGIN_DOMAIN.length + 1));
    // ескі форматтағы m7701...@automax.local — телефон логин
    if (/^m7\d{10}$/.test(local) && user.phone) return formatPhoneLogin(user.phone);
    return local;
  }
  return user.phone ? formatPhoneLogin(user.phone) : user.email;
}

export function formatPhoneLogin(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length !== 11) return phone;
  return `8 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}`;
}

const TRANSLIT: Record<string, string> = {
  а: "a", ә: "a", б: "b", в: "v", г: "g", ғ: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", қ: "q", л: "l", м: "m", н: "n", ң: "n", о: "o", ө: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
  ұ: "u", ү: "u", ф: "f", х: "h", һ: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "y", і: "i", ь: "",
  э: "e", ю: "yu", я: "ya",
};

/** "Жанерке 2" → "zhanerke2" — менеджердің қысқа логині. */
export function loginSlug(name: string): string {
  const s = [...name.trim().toLowerCase()].map((ch) => TRANSLIT[ch] ?? ch).join("");
  return s.replace(/[^a-z0-9]/g, "") || "manager";
}
