export const STAFF_WORKSPACE_ROLES = new Set<string>([
  'admin',
  'manager',
  'user',
  'cashier',
  'pharmacist',
]);

export const DEBUG_TAP_THRESHOLD = 5;

export interface RoleBearingUser {
  role?: string | null;
}

export function normalizeUserRole(role?: string | null): string {
  return typeof role === 'string' ? role.trim().toLowerCase() : '';
}

export function canViewStaffWorkspace(user: RoleBearingUser | null | undefined): boolean {
  if (!user) return false;
  return STAFF_WORKSPACE_ROLES.has(normalizeUserRole(user.role));
}

export function canViewDeveloperInfo(user: RoleBearingUser | null | undefined): boolean {
  if (!user) return false;
  return normalizeUserRole(user.role) === 'admin';
}

export function shouldRevealDeveloperInfo(
  user: RoleBearingUser | null | undefined,
  tapCount: number
): boolean {
  return canViewDeveloperInfo(user) && tapCount >= DEBUG_TAP_THRESHOLD;
}

export function formatRoleBadgeLabel(role?: string | null): string {
  const normalized = normalizeUserRole(role);
  switch (normalized) {
    case 'admin':
      return 'ADMIN';
    case 'manager':
      return 'MANAGER';
    case 'pharmacist':
      return 'PHARMACIST';
    case 'cashier':
      return 'CASHIER';
    case 'user':
      return 'STAFF';
    case 'customer':
    case 'patient':
      return 'CUSTOMER';
    default:
      return normalized ? normalized.toUpperCase() : 'CUSTOMER';
  }
}
