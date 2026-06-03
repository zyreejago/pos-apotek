"use client";

import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useSidebar } from './SidebarContext';

interface KeyboardShortcutsContextType {
  searchInputRef: React.MutableRefObject<HTMLInputElement | null>;
  setSearchInputRef: (ref: React.MutableRefObject<HTMLInputElement | null>) => void;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType | undefined>(undefined);

export function KeyboardShortcutsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { toggleSidebar } = useSidebar();
  const [searchInputRef, setSearchInputRefState] = useState<React.MutableRefObject<HTMLInputElement | null> | null>(null);

  const setSearchInputRef = useCallback((ref: React.MutableRefObject<HTMLInputElement | null>) => {
    setSearchInputRefState(ref);
  }, []);

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;

      // Sidebar toggle: Ctrl/Cmd + B
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // Skip if already typing or it's a modifier key
      if (isTyping || e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      // Navigation shortcuts with number keys - FIRST CHECK THESE!
      switch (e.key) {
        case '1':
          router.push('/dashboard');
          return;
        case '2':
          router.push('/products');
          return;
        case '3':
          router.push('/stock-opname');
          return;
        case '4':
          router.push('/suppliers');
          return;
        case '5':
          router.push('/prescriptions');
          return;
        case '6':
          router.push('/transactions');
          return;
        case '7':
          router.push('/users');
          return;
        case '8':
          router.push('/recommendations');
          return;
      }

      // Search shortcuts
      if (searchInputRef?.current) {
        const isSlash = e.key === '/';
        const isSearchCombo = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
        const isAlpha = /^[a-zA-Z]$/.test(e.key); // Only letters, not numbers (numbers are for navigation)

        if (isSlash || isSearchCombo) {
          e.preventDefault();
          searchInputRef.current.focus();
          searchInputRef.current.select();
          return;
        }

        if (isAlpha) {
          // Just focus, don't prevent default - let the browser type the letter!
          searchInputRef.current.focus();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router, searchInputRef, toggleSidebar]);

  return (
    <KeyboardShortcutsContext.Provider
      value={{
        searchInputRef: searchInputRef || { current: null },
        setSearchInputRef,
      }}
    >
      {children}
    </KeyboardShortcutsContext.Provider>
  );
}

export function useKeyboardShortcuts() {
  const context = useContext(KeyboardShortcutsContext);
  if (context === undefined) {
    throw new Error('useKeyboardShortcuts must be used within a KeyboardShortcutsProvider');
  }
  return context;
}
