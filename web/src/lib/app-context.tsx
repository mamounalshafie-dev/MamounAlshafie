import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from './api';
import { CheckCircle2, AlertCircle, Info, XCircle } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Auth                                                              */
/* ------------------------------------------------------------------ */
export type User = {
  id: number; name: string; email: string; role: string;
  jobTitle?: string; department?: string; phone?: string; avatarColor?: string;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: User | null) => void;
};

const AuthContext = createContext<AuthCtx>(null as any);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const d = await api.post('/auth/login', { email, password });
    setUser(d.user);
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } finally { setUser(null); }
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>{children}</AuthContext.Provider>;
}

/* ------------------------------------------------------------------ */
/*  Toasts                                                            */
/* ------------------------------------------------------------------ */
type Toast = { id: number; type: 'success' | 'error' | 'info'; message: string };
const ToastContext = createContext<{ push: (message: string, type?: Toast['type']) => void }>({ push: () => {} });
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const push = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);

  const icons = { success: CheckCircle2, error: AlertCircle, info: Info };
  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => {
          const Icon = icons[t.type] || Info;
          return (
            <div key={t.id} className={`toast ${t.type}`}>
              <Icon size={18} className="t-icon" />
              <span className="grow">{t.message}</span>
              <button className="btn btn-ghost btn-icon" onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))}>
                <XCircle size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Meta (lookups)                                                    */
/* ------------------------------------------------------------------ */
export type Meta = {
  users: { id: number; name: string; email: string; role: string; job_title?: string; department?: string; avatar_color?: string }[];
  customers: { id: number; name: string }[];
  vendors: { id: number; name: string }[];
  products: { id: number; sku: string; name: string; sale_price: number; cost_price: number; uom: string; stock_qty: number; category?: string }[];
  projects: { id: number; code: string; name: string; stage: string }[];
  departments: { id: number; name: string }[];
  accounts: { id: number; code: string; name: string; type: string }[];
  stages: string[];
  today: string;
};

const MetaContext = createContext<{ meta: Meta | null; reload: () => void }>({ meta: null, reload: () => {} });
export const useMeta = () => useContext(MetaContext);

export function MetaProvider({ children }: { children: React.ReactNode }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const load = useCallback(() => {
    api.get('/meta').then(setMeta).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  return <MetaContext.Provider value={{ meta, reload: load }}>{children}</MetaContext.Provider>;
}

/* ------------------------------------------------------------------ */
/*  Data fetching                                                     */
/* ------------------------------------------------------------------ */
export function useApi<T = any>(path: string | null, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [tick, setTick] = useState(0);
  const pathRef = useRef(path);
  pathRef.current = path;

  useEffect(() => {
    if (!path) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.get<T>(path)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof ApiError ? e.message : 'تعذّر تحميل البيانات');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const mutate = useCallback((updater: (prev: T | null) => T | null) => {
    setData((prev) => updater(prev));
  }, []);
  return { data, error, loading, reload, mutate, setData };
}

export function useDebounced<T>(value: T, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
