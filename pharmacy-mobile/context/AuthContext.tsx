import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'mediquick.auth';
const TOKEN_KEY = 'mediquick.token';

/**
 * Backend roles:
 *   'user'    → pharmacy staff  (cashier / dispenser)
 *   'manager' → manager / supervisor
 *   'admin'   → full system administrator
 */
export type UserRole = 'user' | 'manager' | 'admin';

export type AuthUser = {
  id?: number;
  username: string;
  role: UserRole | string;
  email?: string | null;
  locations?: string[];
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

/**
 * All protected operational pages.
 * Access by role:
 *   staff   ('user')    → support-center, orders, pos, inventory
 *   manager             → + dashboard, add-stock, customers, suppliers, prescriptions, expenses
 *   admin               → all of the above + profit-loss, reports, team
 */
export type ProtectedPage =
  | 'support-center'
  | 'orders'
  | 'pos'
  | 'inventory'
  | 'dashboard'
  | 'add-stock'
  | 'customers'
  | 'suppliers'
  | 'prescriptions'
  | 'expenses'
  | 'profit-loss'
  | 'reports'
  | 'team';

export const ROLE_ACCESS: Record<UserRole, ProtectedPage[]> = {
  user: ['support-center', 'orders', 'pos', 'inventory'],
  manager: [
    'support-center',
    'orders',
    'pos',
    'inventory',
    'dashboard',
    'add-stock',
    'customers',
    'suppliers',
    'prescriptions',
    'expenses',
  ],
  admin: [
    'support-center',
    'orders',
    'pos',
    'inventory',
    'dashboard',
    'add-stock',
    'customers',
    'suppliers',
    'prescriptions',
    'expenses',
    'profit-loss',
    'reports',
    'team',
  ],
};

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (session: AuthSession) => Promise<void>;
  logout: () => Promise<void>;
  /** True if the signed-in user has at least one of the given roles */
  hasRole: (...roles: UserRole[]) => boolean;
  /** True if the signed-in user can access the given protected page */
  canAccess: (page: ProtectedPage) => boolean;
  isAdmin: boolean;
  isManagerOrAdmin: boolean;
  /** True if the user is a regular staff member (role === 'user') */
  isStaff: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const rawSession = await SecureStore.getItemAsync(SESSION_KEY);
        const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        if (storedToken) {
          setToken(storedToken);
        }
        if (rawSession) {
          const session = JSON.parse(rawSession) as AuthSession;
          if (session.user) {
            setUser(session.user);
          }
        }
      } catch (err) {
        console.error('Failed to load user from SecureStore', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadSession();
  }, []);

  const login = async (session: AuthSession) => {
    try {
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
      await SecureStore.setItemAsync(TOKEN_KEY, session.token);
      setToken(session.token);
      setUser(session.user);
    } catch (err) {
      console.error('Failed to save user to SecureStore', err);
    }
  };

  const logout = async () => {
    try {
      await SecureStore.deleteItemAsync(SESSION_KEY);
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      setToken(null);
      setUser(null);
    } catch (err) {
      console.error('Failed to clear user from SecureStore', err);
    }
  };

  const hasRole = (...roles: UserRole[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role as UserRole);
  };

  const canAccess = (page: ProtectedPage): boolean => {
    if (!user) return false;
    const allowed = ROLE_ACCESS[user.role as UserRole] ?? [];
    return allowed.includes(page);
  };

  const isAdmin = user?.role === 'admin';
  const isManagerOrAdmin = user?.role === 'admin' || user?.role === 'manager';
  const isStaff = user?.role === 'user';

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, logout, hasRole, canAccess, isAdmin, isManagerOrAdmin, isStaff }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
