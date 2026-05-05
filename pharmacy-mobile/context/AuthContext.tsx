import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'mediquick.auth';
const TOKEN_KEY = 'mediquick.token';

type AuthUser = {
  id?: number;
  username: string;
  role: string;
  email?: string | null;
  locations?: string[];
};

type AuthSession = {
  token: string;
  user: AuthUser;
};

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (session: AuthSession) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const rawSession = await SecureStore.getItemAsync(SESSION_KEY);
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
      setUser(session.user);
    } catch (err) {
      console.error('Failed to save user to SecureStore', err);
    }
  };

  const logout = async () => {
    try {
      await SecureStore.deleteItemAsync(SESSION_KEY);
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      setUser(null);
    } catch (err) {
      console.error('Failed to clear user from SecureStore', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
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
