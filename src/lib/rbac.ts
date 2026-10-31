import type { PermissionAction, PermissionScope } from "@/lib/db";

export class ForbiddenError extends Error {
  constructor(resource: string, action: PermissionAction) {
    super(`Forbidden: ${action} on ${resource}`);
    this.name = "ForbiddenError";
  }
}

// packages/auth-тан келетін session user толық типіне тәуелді болмас үшін
// осы модуль тек RBAC-қа қажетті ішкі пішінді талап етеді.
export interface AuthorizableUser {
  id: string;
  employee?: { departmentId: string | null; branchId: string | null } | null;
  userRoles: Array<{
    branchId: string | null;
    departmentId: string | null;
    role: {
      rolePermissions: Array<{
        scope: PermissionScope;
        permission: { resource: string; action: PermissionAction };
      }>;
    };
  }>;
}

const SCOPE_RANK: Record<PermissionScope, number> = {
  OWN: 0,
  DEPARTMENT: 1,
  BRANCH: 1,
  ALL: 2,
};

/** Пайдаланушының берілген resource+action үшін ең кең scope-ын қайтарады, немесе жоқ болса null. */
export function resolveScope(
  user: AuthorizableUser,
  resource: string,
  action: PermissionAction
): PermissionScope | null {
  let best: PermissionScope | null = null;
  for (const userRole of user.userRoles) {
    for (const rp of userRole.role.rolePermissions) {
      if (rp.permission.resource !== resource || rp.permission.action !== action) continue;
      if (best === null || SCOPE_RANK[rp.scope] > SCOPE_RANK[best]) {
        best = rp.scope;
      }
    }
  }
  return best;
}

export function can(user: AuthorizableUser, resource: string, action: PermissionAction): boolean {
  return resolveScope(user, resource, action) !== null;
}

/** rbacGuard: рұқсат жоқ болса ForbiddenError лақтырады. Service/tRPC procedure-дің басында шақырылады. */
export function assertPermission(
  user: AuthorizableUser,
  resource: string,
  action: PermissionAction
): PermissionScope {
  const scope = resolveScope(user, resource, action);
  if (!scope) throw new ForbiddenError(resource, action);
  return scope;
}

/**
 * Scope-қа сай Prisma `where` бөлшегін құрайды — деректі frontend-те емес,
 * query деңгейінде сүзу үшін (§26: backend/API деңгейінде рұқсат тексеру).
 */
export function scopeWhere(
  user: AuthorizableUser,
  scope: PermissionScope,
  fields: { ownerField?: string; departmentField?: string; branchField?: string }
): Record<string, unknown> {
  switch (scope) {
    case "ALL":
      return {};
    case "BRANCH":
      return fields.branchField && user.employee?.branchId
        ? { [fields.branchField]: user.employee.branchId }
        : {};
    case "DEPARTMENT":
      return fields.departmentField && user.employee?.departmentId
        ? { [fields.departmentField]: user.employee.departmentId }
        : {};
    case "OWN":
    default:
      return fields.ownerField ? { [fields.ownerField]: user.id } : {};
  }
}
