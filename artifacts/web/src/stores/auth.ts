import { create } from 'zustand';
import { api } from '@/lib/api';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  workspaceName: string;
  workspaceSlug: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  workspaceSlug: string | null;
  isAuthenticated: boolean;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  logout: () => void;
  setWorkspace: (slug: string) => void;
  restoreSession: () => Promise<void>;
}

type AuthStore = AuthState & AuthActions;

interface LoginResponseData {
  user: AuthUser;
  token: string;
  workspace?: { id: string; name: string; slug: string };
}

interface RegisterResponseData {
  user: AuthUser;
  token: string;
  workspace: { id: string; name: string; slug: string };
}

const TOKEN_KEY = 'pp_token';
const USER_KEY = 'pp_user';
const WORKSPACE_KEY = 'pp_workspace_slug';

function loadPersistedState(): { token: string | null; user: AuthUser | null; workspaceSlug: string | null } {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const userJson = localStorage.getItem(USER_KEY);
    const workspaceSlug = localStorage.getItem(WORKSPACE_KEY);
    const user = userJson ? (JSON.parse(userJson) as AuthUser) : null;
    return { token, user, workspaceSlug };
  } catch {
    return { token: null, user: null, workspaceSlug: null };
  }
}

function persistState(token: string, user: AuthUser, workspaceSlug: string | null) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    if (workspaceSlug) localStorage.setItem(WORKSPACE_KEY, workspaceSlug);
  } catch {
    // SSR / incognito
  }
}

function clearPersistedState() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(WORKSPACE_KEY);
  } catch {
    // SSR / incognito
  }
}

export const useAuthStore = create<AuthStore>((set, get) => {
  const persisted = loadPersistedState();

  return {
    user: persisted.user,
    token: persisted.token,
    workspaceSlug: persisted.workspaceSlug,
    isAuthenticated: !!persisted.token,

    async login(email: string, password: string) {
      const res = await api.post<LoginResponseData>('/auth/login', { email, password });
      const data = res.data;
      if (!data) throw new Error(res.error ?? 'Login failed');

      api.setToken(data.token);

      const workspaceSlug = data.workspace?.slug ?? get().workspaceSlug;

      persistState(data.token, data.user, workspaceSlug);

      set({
        user: data.user,
        token: data.token,
        workspaceSlug,
        isAuthenticated: true,
      });
    },

    async register(payload: RegisterPayload) {
      const res = await api.post<RegisterResponseData>('/auth/register', payload);
      const data = res.data;
      if (!data) throw new Error(res.error ?? 'Registration failed');

      api.setToken(data.token);

      const workspaceSlug = data.workspace.slug;

      persistState(data.token, data.user, workspaceSlug);

      set({
        user: data.user,
        token: data.token,
        workspaceSlug,
        isAuthenticated: true,
      });
    },

    logout() {
      api.clearToken();
      clearPersistedState();
      set({
        user: null,
        token: null,
        workspaceSlug: null,
        isAuthenticated: false,
      });
    },

    setWorkspace(slug: string) {
      try { localStorage.setItem(WORKSPACE_KEY, slug); } catch {}
      set({ workspaceSlug: slug });
    },

    async restoreSession() {
      const token = get().token;
      if (!token || get().user) return;

      try {
        api.setToken(token);
        const res = await api.get<{ user: AuthUser; workspaceSlug: string | null }>('/auth/me');
        if (res.data) {
          const wsSlug = res.data.workspaceSlug ?? get().workspaceSlug;
          persistState(token, res.data.user, wsSlug);
          set({
            user: res.data.user,
            workspaceSlug: wsSlug,
            isAuthenticated: true,
          });
        }
      } catch {
        // Token expired — log out
        get().logout();
      }
    },
  };
});
