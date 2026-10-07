const PERMISSIONS_KEY = 'pharmacy:permissions';

const Permissions = Object.freeze({
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  INVENTORY_READ: 'inventory:read',
  INVENTORY_WRITE: 'inventory:write',
  SALES_READ: 'sales:read',
  SALES_WRITE: 'sales:write',
  CUSTOMERS_READ: 'customers:read',
  CUSTOMERS_WRITE: 'customers:write',
  PRESCRIPTIONS_READ: 'prescriptions:read',
  PRESCRIPTIONS_WRITE: 'prescriptions:write',
  EXPENSES_READ: 'expenses:read',
  EXPENSES_WRITE: 'expenses:write',
  SUPPLIERS_READ: 'suppliers:read',
  SUPPLIERS_WRITE: 'suppliers:write',
  ANALYTICS_READ: 'analytics:read',
});

const ROLE_PERMISSIONS = Object.freeze({
  admin: Object.values(Permissions),
  manager: Object.values(Permissions).filter((permission) => !permission.startsWith('users:')),
  user: [
    Permissions.INVENTORY_READ,
    Permissions.SALES_READ,
    Permissions.SALES_WRITE,
    Permissions.CUSTOMERS_READ,
    Permissions.PRESCRIPTIONS_READ,
  ],
  customer: [],
});

module.exports = { PERMISSIONS_KEY, Permissions, ROLE_PERMISSIONS };