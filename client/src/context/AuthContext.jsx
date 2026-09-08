import { createContext, useContext, useCallback, useState } from 'react';
import { api, setAccessToken } from '../api/client.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setAccessToken(null);
    localStorage.removeItem('kt_refresh');
    setUser(null);
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const { user } = await api.get('/auth/me');
      setUser(user);
      return user;
    } catch {
      logout();
      return null;
    }
  }, [logout]);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    await refreshMe();
    setLoading(false);
  }, [refreshMe]);

  // roles helpers
  const role = user?.role;
  const isAdmin = role === 'super_admin';
  const isManager = role === 'manager';
  const isAgent = role === 'lead_agent';

  return (
    <AuthCtx.Provider value={{ user, setUser, loading, refreshMe, bootstrap, logout, role, isAdmin, isManager, isAgent }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}