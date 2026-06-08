"use client";

import React, { useRef, useCallback, useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import OffCanvasRenderer from './OffCanvasRenderer';
import { useOffCanvas } from '@/context/OffCanvasContext';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/register' || pathname === '/forgot-password';
  const { isAnyOffCanvasOpen, offCanvasWidth, setOffCanvasWidth } = useOffCanvas();
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const minWidth = 300;
  const maxWidth = 800;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;
    startWidthRef.current = parseInt(offCanvasWidth) || 400;

    const handleMouseMove = (ev: MouseEvent) => {
      const deltaX = startXRef.current - ev.clientX;
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidthRef.current + deltaX));
      setOffCanvasWidth(`${newWidth}px`);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [offCanvasWidth, setOffCanvasWidth]);

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-x-hidden">
      <Sidebar />

      {/* Area kanan: main + offcanvas, dibatasi sisa lebar setelah sidebar */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Main content — menyempit saat offcanvas buka */}
        <div
          className="flex flex-col overflow-hidden"
          style={{
            flex: 1,
            minWidth: 0,
            transition: isDragging ? 'none' : 'margin-right 400ms cubic-bezier(0.4, 0, 0.2, 1)',
            marginRight: isAnyOffCanvasOpen ? offCanvasWidth : '0px',
          }}
        >
          <Header />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>

        {/* Offcanvas — absolute di kanan, slide dari luar */}
        <div
          id="offcanvas-root"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            height: '100%',
            width: offCanvasWidth,
            maxWidth: '100vw',
            transform: isAnyOffCanvasOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: isDragging ? 'none' : 'transform 400ms cubic-bezier(0.4, 0, 0.2, 1)',
            zIndex: 50,
            boxShadow: isAnyOffCanvasOpen ? '-4px 0 24px rgba(0,0,0,0.12)' : 'none',
          }}
          className="bg-white h-full"
        >
          {/* Drag handle */}
          {isAnyOffCanvasOpen && (
            <div
              onMouseDown={handleMouseDown}
              className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400 hover:w-2 z-10 transition-all duration-150 group"
              style={{ marginLeft: '-4px' }}
            >
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-8 bg-white border border-gray-200 rounded-r-md shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg width="8" height="16" viewBox="0 0 8 16" fill="none" className="text-gray-400">
                  <circle cx="2" cy="4" r="1" fill="currentColor"/>
                  <circle cx="6" cy="4" r="1" fill="currentColor"/>
                  <circle cx="2" cy="8" r="1" fill="currentColor"/>
                  <circle cx="6" cy="8" r="1" fill="currentColor"/>
                  <circle cx="2" cy="12" r="1" fill="currentColor"/>
                  <circle cx="6" cy="12" r="1" fill="currentColor"/>
                </svg>
              </div>
            </div>
          )}
          <OffCanvasRenderer inline />
        </div>

      </div>
    </div>
  );
}
