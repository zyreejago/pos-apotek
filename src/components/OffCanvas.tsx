'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
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
    setOffCanvasWidth,
    closeOffCanvas 
  } = useOffCanvas();

  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);

  const prevIsOpen = useRef(isOpen);

  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
  console.log('OFFCANVAS EFFECT', {
    title,
    isOpen,
    width
  });

  if (isOpen) {
    setIsAnyOffCanvasOpen(true);
    setOffCanvasWidth(width);
  } else if (prevIsOpen.current) {
    console.log('CLOSING', title);
    closeOffCanvas();
  }

  prevIsOpen.current = isOpen;
}, [isOpen]);
useEffect(() => {
  return () => {
    closeOffCanvas();
  };
}, [closeOffCanvas]);
  useEffect(() => {
    if (isOpen) {
      setIsAnyOffCanvasOpen(true);
      setOffCanvasWidth(width);
    } else if (prevIsOpen.current) {
      // Only call closeOffCanvas() when isOpen transitions from true to false
      closeOffCanvas();
    }
    prevIsOpen.current = isOpen;
  }, [isOpen, width, setIsAnyOffCanvasOpen, setOffCanvasWidth, closeOffCanvas]);

  // Simpan scroll position sebelum re-render
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Restore scroll setelah render
    el.scrollTop = scrollPositionRef.current;

    const handleScroll = () => {
      scrollPositionRef.current = el.scrollTop;
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  });

  if (!isOpen || !mounted) return null;

  const root = document.getElementById('offcanvas-root');
  if (!root) return null;

  return createPortal(
    <div className="flex flex-col h-full w-full bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between shrink-0">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <button 
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <X size={20} />
        </button>
      </div>
      
      {/* Body */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6"
      >
        {children}
      </div>
    </div>,
    root
  );
}
