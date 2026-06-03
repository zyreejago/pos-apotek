"use client";

import { createContext, useContext, useState, ReactNode } from 'react';

interface OffCanvasContextType {
  isAnyOffCanvasOpen: boolean;
  setIsAnyOffCanvasOpen: (open: boolean) => void;
  offCanvasContent: ReactNode | null;
  setOffCanvasContent: (content: ReactNode | null) => void;
  offCanvasWidth: string;
  setOffCanvasWidth: (width: string) => void;
  closeOffCanvas: () => void;
}

const OffCanvasContext = createContext<OffCanvasContextType | undefined>(undefined);

export function OffCanvasProvider({ children }: { children: ReactNode }) {
  const [isAnyOffCanvasOpen, setIsAnyOffCanvasOpen] = useState(false);
  const [offCanvasContent, setOffCanvasContent] = useState<ReactNode | null>(null);
  const [offCanvasWidth, setOffCanvasWidth] = useState("400px");

  const closeOffCanvas = () => {
    setIsAnyOffCanvasOpen(false);
    setOffCanvasContent(null);
  };

  return (
    <OffCanvasContext.Provider value={{ 
      isAnyOffCanvasOpen, 
      setIsAnyOffCanvasOpen, 
      offCanvasContent, 
      setOffCanvasContent,
      offCanvasWidth,
      setOffCanvasWidth,
      closeOffCanvas
    }}>
      {children}
    </OffCanvasContext.Provider>
  );
}

export function useOffCanvas() {
  const context = useContext(OffCanvasContext);
  if (context === undefined) {
    throw new Error('useOffCanvas must be used within an OffCanvasProvider');
  }
  return context;
}