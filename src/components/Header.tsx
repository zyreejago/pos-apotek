'use client';

import React from 'react';
import ProfileDropdown from './ProfileDropdown';
import { useHeader } from '@/context/HeaderContext';

interface Breadcrumb {
  label: string;
  href?: string;
}

export default function Header() {
  const { headerState } = useHeader();
  const { title, subtitle, breadcrumbs = [], rightContent } = headerState;
  return (
    <header className="bg-white px-2 sm:px-6 py-2 sm:py-4 mb-2 sm:mb-8 flex justify-between items-center shrink-0 shadow-sm sticky top-0 z-30 gap-1 sm:gap-0">
      <div className="min-w-0 flex-1 mr-1 sm:mr-2">
        {breadcrumbs.length > 0 ? (
          <div className="flex items-center gap-1 sm:gap-4 text-[11px] sm:text-sm text-gray-500 overflow-x-auto">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={index}>
                {index > 0 && <span className="shrink-0">/</span>}
                <span className={`shrink-0 whitespace-nowrap ${index === breadcrumbs.length - 1 ? "font-bold text-gray-900" : ""}`}>
                  {crumb.label}
                </span>
              </React.Fragment>
            ))}
          </div>
        ) : (
          <div>
            {title && <h1 className="text-sm sm:text-xl font-bold text-gray-900 truncate">{title}</h1>}
            {subtitle && <p className="text-gray-500 text-[11px] sm:text-sm truncate">{subtitle}</p>}
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-1 sm:gap-3 shrink-0 min-w-0">
        {rightContent && <div className="flex items-center gap-1 sm:gap-3 overflow-x-auto max-w-[40vw] sm:max-w-none scrollbar-hide">{rightContent}</div>}
        <ProfileDropdown />
      </div>
    </header>
  );
}
