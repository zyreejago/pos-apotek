"use client";

import { createContext, useContext, useState, ReactNode } from 'react';

interface HeaderState {
  title?: string;
  subtitle?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  rightContent?: ReactNode;
}

interface HeaderContextType {
  headerState: HeaderState;
  setHeaderState: (state: HeaderState) => void;
}

const HeaderContext = createContext<HeaderContextType | undefined>(undefined);

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [headerState, setHeaderState] = useState<HeaderState>({});

  return (
    <HeaderContext.Provider value={{ headerState, setHeaderState }}>
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeader() {
  const context = useContext(HeaderContext);
  if (context === undefined) {
    throw new Error('useHeader must be used within a HeaderProvider');
  }
  return context;
}
