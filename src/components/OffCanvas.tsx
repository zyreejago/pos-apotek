'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useOffCanvas } from '@/context/OffCanvasContext';

interface OffCanvasProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}

export default function OffCanvas({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  width = '400px' 
}: OffCanvasProps) {
  const { 
    setIsAnyOffCanvasOpen, 
    setOffCanvasContent, 
    setOffCanvasWidth,
    closeOffCanvas 
  } = useOffCanvas();

  useEffect(() => {
    if (isOpen) {
      setOffCanvasWidth(width);
      setOffCanvasContent(
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between shrink-0">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <button 
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
            >
              <X size={20} />
            </button>
          </div>
          
          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {children}
          </div>
        </div>
      );
      setIsAnyOffCanvasOpen(true);
    } else {
      closeOffCanvas();
    }

    return () => {
      closeOffCanvas();
    };
  }, [isOpen, title, children, width, onClose, setIsAnyOffCanvasOpen, setOffCanvasContent, setOffCanvasWidth, closeOffCanvas]);

  return null;
}