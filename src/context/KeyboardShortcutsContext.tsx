"use client";

import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useSidebar } from './SidebarContext';

interface KeyboardShortcutsContextType {
  searchInputRef: React.MutableRefObject<HTMLInputElement | null>;
  setSearchInputRef: (ref: React.MutableRefObject<HTMLInputElement | null>) => void;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType | undefined>(undefined);

// Find search input on the current page by common placeholder patterns
function findSearchInput(): HTMLInputElement | null {
  const patterns = ['Cari', 'Search', 'cari', 'search', 'Ketik', 'ketik', 'nama', 'name', 'produk'];
  const inputs = document.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])');
  for (const input of inputs) {
    const ph = input.placeholder || '';
    if (ph.length > 0 && patterns.some(p => ph.includes(p))) return input;
  }
  return null;
}

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

      // Skip if already typing
      if (isTyping) {
        return;
      }

      // Search: Ctrl/Cmd + F (standard find shortcut)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        // Try to find any search input on the page
        const searchInput = findSearchInput();
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
          searchInput.select();
          return;
        }
        // Fallback to registered ref
        if (searchInputRef?.current) {
          e.preventDefault();
          searchInputRef.current.focus();
          searchInputRef.current.select();
          return;
        }
      }

      // Skip if modifier keys pressed (no navigation with modifiers)
      if (e.ctrlKey || e.metaKey || e.altKey) {
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
          router.push('/suppliers');
          return;
        case '4':
          router.push('/prescriptions');
          return;
        case '5':
          router.push('/transactions');
          return;
        case '6':
          router.push('/purchase-history');
          return;
        case '7':
          router.push('/approvals');
          return;
        case '8':
          router.push('/users');
          return;
      }

      // Search: press / to focus any search input on the page
      if (e.key === '/') {
        e.preventDefault();
        const searchInput = findSearchInput();
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
          return;
        }
        // Fallback to registered ref
        if (searchInputRef?.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
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
