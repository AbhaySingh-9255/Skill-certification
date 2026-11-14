import axios from 'axios';
import { create } from 'zustand';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'instructor' | 'admin';
  profilePhoto: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  updateProfile: (name: string, email: string, profilePhoto: string | null) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logoutOtherSessions: () => Promise<void>;
  deleteAccount: (currentPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000/api';

interface AuthResponse {
  id: number;
  name: string;
  email: string;
  role: User['role'];
  token: string;
  profile_photo?: string | null;
}

interface ProfileResponse {
  id: number;
  name: string;
  email: string;
  role: User['role'];
  profile_photo?: string | null;
}

const setAuthenticatedUser = (set: (state: Pick<AuthState, 'user' | 'token'>) => void, payload: AuthResponse) => {
  set({
    user: {
      id: String(payload.id),
      name: payload.name,
      email: payload.email,
      role: payload.role,
      profilePhoto: payload.profile_photo ?? null,
    },
    token: payload.token,
  });
};

const apiError = (error: unknown, fallback: string): Error => {
  if (axios.isAxiosError<{ error?: { message?: string } }>(error)) {
    const message = error.response?.data?.error?.message;
    if (message) return new Error(message, { cause: error });
    if (!error.response) {
      return new Error(
        'Cannot reach the API. Check that the backend is running and allows this frontend origin.',
        { cause: error },
      );
    }
  }
  return new Error(fallback, { cause: error });
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  login: async (email, password) => {
    try {
      const response = await axios.post<AuthResponse>(`${API_BASE_URL}/auth/login`, {
        email: email.trim().toLowerCase(),
        password,
      });
      setAuthenticatedUser(set, response.data);
    } catch (error) {
      throw apiError(error, 'Sign-in failed. Check your API connection and credentials.');
    }
  },
  register: async (name, email, password) => {
    try {
      const response = await axios.post<AuthResponse>(`${API_BASE_URL}/auth/register`, {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      setAuthenticatedUser(set, response.data);
    } catch (error) {
      throw apiError(error, 'Account creation failed. Check your API connection and details.');
    }
  },
  updateProfile: async (name, email, profilePhoto) => {
    const token = get().token;
    if (!token) throw new Error('You must be signed in to update your profile.');

    try {
      const response = await axios.put<ProfileResponse>(
        `${API_BASE_URL}/profile`,
        { name: name.trim(), email: email.trim().toLowerCase(), profile_photo: profilePhoto },
        { headers: { Authorization: 'Bearer ' + token } },
      );
      set({
        user: {
          id: String(response.data.id),
          name: response.data.name,
          email: response.data.email,
          role: response.data.role,
          profilePhoto: response.data.profile_photo ?? null,
        },
      });
    } catch (error) {
      throw apiError(error, 'Profile update failed. Please try again.');
    }
  },
  changePassword: async (currentPassword, newPassword) => {
    const token = get().token;
    if (!token) throw new Error('You must be signed in to change your password.');

    try {
      const response = await axios.post<{ token: string }>(
        `${API_BASE_URL}/auth/change-password`,
        { current_password: currentPassword, new_password: newPassword },
        { headers: { Authorization: 'Bearer ' + token } },
      );
      set({ token: response.data.token });
    } catch (error) {
      throw apiError(error, 'Password change failed. Please try again.');
    }
  },
  logoutOtherSessions: async () => {
    const token = get().token;
    if (!token) throw new Error('You must be signed in to manage sessions.');
    try {
      const response = await axios.post<{ token: string }>(
        `${API_BASE_URL}/auth/logout-other-sessions`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      set({ token: response.data.token });
    } catch (error) {
      throw apiError(error, 'Could not sign out other sessions.');
    }
  },
  deleteAccount: async (currentPassword) => {
    const token = get().token;
    if (!token) throw new Error('You must be signed in to delete your account.');
    try {
      await axios.delete(`${API_BASE_URL}/account`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { current_password: currentPassword, confirmation: 'DELETE' },
      });
      set({ user: null, token: null });
    } catch (error) {
      throw apiError(error, 'Could not delete the account.');
    }
  },
  logout: async () => {
    const token = get().token;

    try {
      if (token) {
        await axios.post(
          `${API_BASE_URL}/auth/logout`,
          {},
          { headers: { Authorization: `Bearer ${token}` } },
        );
      }
    } finally {
      set({ user: null, token: null });
    }
  },
}));
