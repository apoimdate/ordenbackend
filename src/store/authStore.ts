import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient, endpoints } from '@/utils/api';
import { User, AuthState } from '@/types';
import toast from 'react-hot-toast';

interface AuthStore extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        
        try {
          const response = await apiClient.post<{
            user: User;
            token: string;
            refreshToken: string;
          }>(endpoints.auth.login, { email, password });

          const { user, token } = response;

          // Store token in localStorage
          localStorage.setItem('admin_token', token);

          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });

          toast.success(`¡Bienvenido, ${user.firstName}!`);
          return true;

        } catch (error) {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
          return false;
        }
      },

      logout: () => {
        // Call logout endpoint
        apiClient.post(endpoints.auth.logout).catch(() => {
          // Ignore errors on logout
        });

        // Clear local storage
        localStorage.removeItem('admin_token');

        // Reset state
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });

        toast.success('Sesión cerrada correctamente');
      },

      checkAuth: async () => {
        const token = localStorage.getItem('admin_token');
        
        if (!token) {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
          return;
        }

        set({ isLoading: true });

        try {
          const user = await apiClient.get<User>(endpoints.auth.me);

          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });

        } catch (error) {
          // Token is invalid
          localStorage.removeItem('admin_token');
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      updateUser: (userData: Partial<User>) => {
        const { user } = get();
        if (user) {
          set({
            user: { ...user, ...userData },
          });
        }
      },
    }),
    {
      name: 'admin-auth-storage',
      partialize: (state) => ({
        token: state.token,
        // Don't persist user data - fetch fresh on app load
      }),
    }
  )
);

// Initialize auth check when store is created
if (typeof window !== 'undefined') {
  useAuthStore.getState().checkAuth();
}