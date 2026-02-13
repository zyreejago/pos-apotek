'use client';

import React from 'react';
import ProfileDropdown from './ProfileDropdown';
import { ChevronRight } from 'lucide-react';

interface Breadcrumb {
  label: string;
  href?: string;
}

interface HeaderProps {
  title?: string;
  subtitle?: string;
  breadcrumbs?: Breadcrumb[];
  rightContent?: React.ReactNode;
}

export default function Header({ title, subtitle, breadcrumbs = [], rightContent }: HeaderProps) {
  return (
    <header className="bg-white px-6 py-4 flex justify-between items-center shrink-0 shadow-sm z-50 mb-6 sticky top-0">
      <div>
        {breadcrumbs.length > 0 ? (
          <div className="flex items-center gap-4 text-sm text-gray-500">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={index}>
                {index > 0 && <span>/</span>}
                <span className={index === breadcrumbs.length - 1 ? "font-bold text-gray-900" : ""}>
                  {crumb.label}
                </span>
              </React.Fragment>
            ))}
          </div>
        ) : (
          <div>
            {title && <h1 className="text-xl font-bold text-gray-900">{title}</h1>}
            {subtitle && <p className="text-gray-500 text-sm">{subtitle}</p>}
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-3">
        {rightContent}
        <ProfileDropdown />
      </div>
    </header>
  );
}
