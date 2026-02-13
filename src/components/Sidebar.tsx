"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Store, 
  Package, 
  ClipboardList, 
  ClipboardCheck, 
  Users, 
  ShoppingCart, 
  UserCheck, 
  FileText, 
  Rocket, 
  Settings, 
  Repeat,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function Sidebar() {
  const [isReportOpen, setIsReportOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  if (pathname === '/login') {
    return null;
  }

  const isActive = (path: string) => pathname === path;

  return (
    <div className={`${isCollapsed ? 'w-20' : 'w-64'} h-screen bg-white border-r border-gray-200 flex flex-col font-sans shrink-0 sticky top-0 transition-all duration-300`}>
      {/* Header */}
      <div className={`p-6 flex items-center ${isCollapsed ? 'justify-center flex-col gap-4' : 'justify-between'}`}>
        <div className="flex items-center gap-2">
            {/* Logo Icon */}
            <div className="text-pink-500">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 26V6L16 16L26 6V26" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            </div>
          {!isCollapsed && <span className="text-xl font-bold text-slate-800 whitespace-nowrap">Sales Point</span>}
        </div>
        <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded hover:bg-gray-100 border border-gray-200 text-gray-400"
        >
             {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Menu Items */}
      <div className="flex-1 overflow-y-auto py-2 px-3 space-y-1 custom-scrollbar">
        
        <NavItem href="/dashboard" icon={<LayoutDashboard size={20} />} label="Dashboards" active={isActive('/dashboard') || isActive('/')} isCollapsed={isCollapsed} />
        <NavItem href="/outlets" icon={<Store size={20} />} label="Outlets" active={isActive('/outlets')} isCollapsed={isCollapsed} />
        <NavItem href="/products" icon={<Package size={20} />} label="Products" active={isActive('/products')} isCollapsed={isCollapsed} />
        <NavItem href="/stock-management" icon={<ClipboardList size={20} />} label="Management Stock" active={isActive('/stock-management')} isCollapsed={isCollapsed} />
        <NavItem href="/stock-opname" icon={<ClipboardCheck size={20} />} label="Stock Opname" active={isActive('/stock-opname')} isCollapsed={isCollapsed} />
        <NavItem href="/suppliers" icon={<Users size={20} />} label="Suppliers" active={isActive('/suppliers')} isCollapsed={isCollapsed} />
        <NavItem href="/transactions" icon={<ShoppingCart size={20} />} label="Transactions" active={isActive('/transactions')} isCollapsed={isCollapsed} />
        <NavItem href="/users" icon={<UserCheck size={20} />} label="Management Pengguna" active={isActive('/users')} isCollapsed={isCollapsed} />
        
        {/* Expandable Menu */}
        <div>
            <button 
                onClick={() => {
                    if (isCollapsed) setIsCollapsed(false);
                    setIsReportOpen(!isReportOpen);
                }}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-3 py-2.5 rounded-lg transition-colors group ${pathname.startsWith('/reports') ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
                title={isCollapsed ? "Sales Report" : ""}
            >
                <div className="flex items-center gap-3">
                    <span className={`group-hover:text-slate-600 ${pathname.startsWith('/reports') ? 'text-slate-600' : 'text-slate-400'}`}>
                        <FileText size={20} />
                    </span>
                    {!isCollapsed && <span className={`font-medium ${pathname.startsWith('/reports') ? 'text-slate-800' : 'text-slate-600'}`}>Sales Report</span>}
                </div>
                {!isCollapsed && <span className="text-slate-400 text-lg leading-none">{isReportOpen ? '−' : '+'}</span>}
            </button>
            
            {isReportOpen && !isCollapsed && (
                <div className="ml-4 mt-1 space-y-1 border-l border-gray-100 pl-2">
                    <Link href="/reports/financial" className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer ${isActive('/reports/financial') ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:text-slate-700 hover:bg-gray-50'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${isActive('/reports/financial') ? 'bg-blue-600' : 'bg-transparent border border-slate-400'}`}></div>
                        <span className="font-medium text-sm">Laporan Keuangan</span>
                    </Link>
                    <Link href="/reports/balance" className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer ${isActive('/reports/balance') ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:text-slate-700 hover:bg-gray-50'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${isActive('/reports/balance') ? 'bg-blue-600' : 'bg-transparent border border-slate-400'}`}></div>
                        <span className="font-medium text-sm">Neraca Keuangan</span>
                    </Link>
                </div>
            )}
        </div>

        <NavItem href="/recommendations" icon={<Rocket size={20} />} label="Recommendation Stock" active={isActive('/recommendations')} isCollapsed={isCollapsed} />
        <NavItem href="/substitutions" icon={<Repeat size={20} />} label="Subtitusi Products" active={isActive('/substitutions')} isCollapsed={isCollapsed} />

        <div className={`pt-4 pb-2 px-3 ${isCollapsed ? 'text-center' : ''}`}>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{isCollapsed ? '...' : 'Others'}</span>
        </div>
        
        <div>
            <button 
                onClick={() => {
                    if (isCollapsed) setIsCollapsed(false);
                    setIsSettingsOpen(!isSettingsOpen);
                }}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-3 py-2.5 rounded-lg transition-colors group ${pathname.startsWith('/settings') ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
                title={isCollapsed ? "System Settings" : ""}
            >
                <div className="flex items-center gap-3">
                    <span className={`group-hover:text-slate-600 ${pathname.startsWith('/settings') ? 'text-slate-600' : 'text-slate-400'}`}>
                        <Settings size={20} />
                    </span>
                    {!isCollapsed && <span className={`font-medium ${pathname.startsWith('/settings') ? 'text-slate-800' : 'text-slate-600'}`}>System Settings</span>}
                </div>
                {!isCollapsed && <span className="text-slate-400 text-lg leading-none">{isSettingsOpen ? '−' : '+'}</span>}
            </button>

            {isSettingsOpen && !isCollapsed && (
                <div className="ml-4 mt-1 space-y-1 border-l border-gray-100 pl-2">
                    <Link href="/settings/role-permissions" className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer ${isActive('/settings/role-permissions') ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:text-slate-700 hover:bg-gray-50'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${isActive('/settings/role-permissions') ? 'bg-blue-600' : 'bg-transparent border border-slate-400'}`}></div>
                        <span className="font-medium text-sm">Role & Permissions</span>
                    </Link>
                </div>
            )}
        </div>

      </div>
    </div>
  );
}

function NavItem({ icon, label, href, active = false, isCollapsed = false }: { icon: React.ReactNode, label: string, href: string, active?: boolean, isCollapsed?: boolean }) {
    return (
        <Link href={href} className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-lg transition-colors ${active ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-gray-50 group'}`} title={isCollapsed ? label : ""}>
            <span className={`${active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
                {icon}
            </span>
            {!isCollapsed && <span className="font-medium whitespace-nowrap">{label}</span>}
        </Link>
    )
}
