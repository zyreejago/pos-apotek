"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SidebarContextType {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  setIsCollapsed: (collapsed: boolean) => void;
  userCollapsedState: boolean;
  setUserCollapsedState: (collapsed: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [userCollapsedState, setUserCollapsedState] = useState(false); // To store user's original choice

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    setUserCollapsedState(newState); // Update userCollapsedState when user manually toggles
  };

  return (
    <SidebarContext.Provider value={{ 
      isCollapsed, 
      toggleSidebar, 
      setIsCollapsed,
      userCollapsedState,
      setUserCollapsedState
    }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
