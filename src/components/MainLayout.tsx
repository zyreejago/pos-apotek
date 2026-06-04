"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import OffCanvasRenderer from './OffCanvasRenderer';
import { useOffCanvas } from '@/context/OffCanvasContext';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/register' || pathname === '/forgot-password';
  const { isAnyOffCanvasOpen, offCanvasWidth } = useOffCanvas();
  console.log('OFFCANVAS DEBUG', {
  isAnyOffCanvasOpen,
  offCanvasWidth
});

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-gray-50" style={{ overflow: 'hidden', maxWidth: '100vw' }}>
      <Sidebar />

      {/* Area kanan: main + offcanvas, dibatasi sisa lebar setelah sidebar */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Main content — menyempit saat offcanvas buka */}
        <div
          className="flex flex-col overflow-hidden"
          style={{
            flex: 1,
            minWidth: 0,
            transition: 'margin-right 400ms cubic-bezier(0.4, 0, 0.2, 1)',
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
            transform: isAnyOffCanvasOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 400ms cubic-bezier(0.4, 0, 0.2, 1)',
            zIndex: 50,
            boxShadow: isAnyOffCanvasOpen ? '-4px 0 24px rgba(0,0,0,0.12)' : 'none',
          }}
          className="bg-white h-full"
        >
          <OffCanvasRenderer inline />
        </div>

      </div>
    </div>
  );
}
