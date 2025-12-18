import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { localDB, UserRole, User } from '../lib/database';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, role: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    try {
      const currentUser = await localDB.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        const userRole = await localDB.getUserRole(currentUser.id);
        setRole(userRole);
      }
    } catch (error) {
      console.error('Error loading session:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const signedInUser = await localDB.signIn(email, password);
      setUser(signedInUser);
      const userRole = await localDB.getUserRole(signedInUser.id);
      setRole(userRole);
    } catch (error: any) {
      throw error;
    }
  };

  const signUp = async (email: string, password: string, userRole: UserRole) => {
    try {
      const newUser = await localDB.signUp(email, password, userRole);
      setUser(newUser);
      setRole(userRole);
    } catch (error: any) {
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await localDB.signOut();
      setUser(null);
      setRole(null);
    } catch (error: any) {
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
