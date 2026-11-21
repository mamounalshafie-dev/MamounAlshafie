import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useApi } from './app-context';

type ReContextValue = {
  projects: any[];
  project: any | null;
  code: string;
  setCode: (code: string) => void;
  reloadProjects: () => void;
  loading: boolean;
  allowAll?: boolean;
};

const ReContext = createContext<ReContextValue | null>(null);
const STORAGE_KEY = 'mc_project';

export function ReProvider({ children }: { children: React.ReactNode }) {
  const [code, setCodeState] = useState<string>(() => localStorage.getItem(STORAGE_KEY) || 'MC-A');
  const { data, loading, reload } = useApi<any>('/re/meta', []);

  const projects = data?.projects || [];
  const project = useMemo(() => projects.find((p) => p.code === code) || null, [projects, code]);

  useEffect(() => {
    if (!loading && projects.length && !project && code !== 'all') {
      const fallback = projects[0]?.code;
      if (fallback) setCodeState(fallback);
    }
  }, [loading, projects, project, code]);

  const setCode = (next: string) => {
    setCodeState(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <ReContext.Provider value={{ projects, project, code, setCode, reloadProjects: reload, loading }}>
      {children}
    </ReContext.Provider>
  );
}

export const useRe = () => {
  const ctx = useContext(ReContext);
  if (!ctx) throw new Error('useRe must be used inside ReProvider');
  return ctx;
};

export const UNIT_STATUS: Record<string, string> = {
  available: 'متاحة للبيع',
  reserved: 'محجوزة',
  sold: 'مباعة',
  rented: 'مؤجرة',
  blocked: 'موقوفة',
};

export const UNIT_TONE: Record<string, string> = {
  available: 'green',
  reserved: 'amber',
  sold: 'red',
  rented: 'blue',
  blocked: 'slate',
};

export const UNIT_COLOR: Record<string, string> = {
  available: '#16a34a',
  reserved: '#d97706',
  sold: '#dc2626',
  rented: '#2563eb',
  blocked: '#64748b',
};
