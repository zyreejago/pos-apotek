'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface OffCanvasContextType {
  isAnyOffCanvasOpen: boolean;
  offCanvasWidth: string;
  setIsAnyOffCanvasOpen: (val: boolean) => void;
  setOffCanvasWidth: (width: string) => void;
  closeOffCanvas: () => void;
}

const OffCanvasContext = createContext<OffCanvasContextType | undefined>(undefined);

export function OffCanvasProvider({ children }: { children: React.ReactNode }) {
  const [isAnyOffCanvasOpen, setIsAnyOffCanvasOpenState] = useState(false);
  const [offCanvasWidth, setOffCanvasWidthState] = useState('400px');

  const setIsAnyOffCanvasOpen = useCallback((val: boolean) => {
    setIsAnyOffCanvasOpenState(val);
  }, []);

  const setOffCanvasWidth = useCallback((width: string) => {
    setOffCanvasWidthState(width);
  }, []);

  const closeOffCanvas = useCallback(() => {
    setIsAnyOffCanvasOpenState(false);
    setOffCanvasWidthState('400px');
  }, []);

  return (
    <OffCanvasContext.Provider value={{
      isAnyOffCanvasOpen,
      offCanvasWidth,
      setIsAnyOffCanvasOpen,
      setOffCanvasWidth,
      closeOffCanvas,
    }}>
      {children}
    </OffCanvasContext.Provider>
  );
}

export function useOffCanvas() {
  const context = useContext(OffCanvasContext);
  if (!context) {
    throw new Error('useOffCanvas must be used within an OffCanvasProvider');
  }
  return context;
}
