import { supabase } from './supabase';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'cashier';
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
}

export const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
};

export const login = async (email: string, password: string): Promise<AuthResponse> => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!users) {
      return { success: false, error: 'Invalid email or password' };
    }

    const isValid = await verifyPassword(password, users.password_hash);

    if (!isValid) {
      return { success: false, error: 'Invalid email or password' };
    }

    const user: User = {
      id: users.id,
      email: users.email,
      full_name: users.full_name,
      role: users.role,
    };

    localStorage.setItem('currentUser', JSON.stringify(user));

    return { success: true, user };
  } catch (error) {
    return { success: false, error: 'An error occurred during login' };
  }
};

export const logout = () => {
  localStorage.removeItem('currentUser');
};

export const getCurrentUser = (): User | null => {
  const userStr = localStorage.getItem('currentUser');
  if (!userStr) return null;

  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};

export const isAuthenticated = (): boolean => {
  return getCurrentUser() !== null;
};

export const isAdmin = (): boolean => {
  const user = getCurrentUser();
  return user?.role === 'admin';
};