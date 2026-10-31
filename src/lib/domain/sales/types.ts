import type { PermissionAction, PermissionScope } from "@/lib/db";

export interface ActingUser {
  id: string;
  employee?: { id: string; departmentId: string | null; branchId: string | null } | null;
  userRoles: Array<{
    branchId: string | null;
    departmentId: string | null;
    role: {
      name: string;
      rolePermissions: Array<{
        scope: PermissionScope;
        permission: { resource: string; action: PermissionAction };
      }>;
    };
  }>;
}
