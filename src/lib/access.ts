// Рөлге байланысты қарапайым тексерулер (бет деңгейі).
// Деректер деңгейіндегі нақты рұқсат — rbac.ts + domain сервистерінде.

type RoleCarrier = { userRoles: Array<{ role: { name: string } }> };

export const LEADER_ROLES = ["CEO", "ADMIN", "DEPARTMENT_HEAD"] as const;
export const MANAGER_ROLES = ["SALES_MANAGER", "SENIOR_SALES_MANAGER"] as const;

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

/** Менеджерге рұқсат етілген беттер (қалғаны /rating-ке бағытталады). */
export const MANAGER_ALLOWED_PREFIXES = ["/rating", "/departments/sales/almaty", "/change-password"];

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
  return isSalesManagerOnly(user) ? "/rating" : "/dashboard";
}

/** Логин: email немесе телефон. Телефонды тек цифрларға келтіреміз (8/7 басы → 7...). */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && (digits.startsWith("8") || digits.startsWith("7"))) return "7" + digits.slice(1);
  if (digits.length === 10) return "7" + digits;
  return null;
}
