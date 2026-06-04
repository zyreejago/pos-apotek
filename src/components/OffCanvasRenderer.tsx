'use client';

import React from 'react';
import { useOffCanvas } from '@/context/OffCanvasContext';

interface OffCanvasRendererProps {
  inline?: boolean;
}

export default function OffCanvasRenderer({ inline }: OffCanvasRendererProps) {
  const { isAnyOffCanvasOpen, offCanvasContent, closeOffCanvas } = useOffCanvas();

  if (!isAnyOffCanvasOpen) return null;

  if (inline) {
    // Inline mode: no backdrop, just render content directly
    return offCanvasContent;
  }

  // Original overlay mode (not used now)
  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-black/50 transition-opacity duration-300 cursor-pointer"
        onClick={closeOffCanvas}
      />
      <div className="absolute top-0 right-0 h-full bg-white shadow-2xl">
        {offCanvasContent}
      </div>
    </div>
  );
}
