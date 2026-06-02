import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  accessToken: string | null;
  user: any | null; // Will refine type later
  setAuth: (token: string, user: any) => void;
  updateUser: (userUpdates: Partial<any>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      setAuth: (token, user) => set({ accessToken: token, user }),
      updateUser: (userUpdates) => 
        set((state) => ({
          user: state.user ? { ...state.user, ...userUpdates } : null,
        })),
      logout: () => set({ accessToken: null, user: null }),
    }),
    {
      name: 'snet-auth-storage',
    }
  )
);
