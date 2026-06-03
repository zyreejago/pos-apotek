"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Package, 
  ClipboardCheck, 
  Users, 
  ShoppingCart, 
  UserCheck, 
  FileText, 
  Rocket, 
  Settings, 
  Repeat,
  ChevronLeft,
  ChevronRight,
  Activity
} from 'lucide-react';
import { useOffCanvas } from '@/context/OffCanvasContext';
import { useSidebar } from '@/context/SidebarContext';

interface Permission {
  module: string;
  create: boolean;
  edit: boolean;
  delete: boolean;
  show: boolean;
}

export default function Sidebar() {
  const router = useRouter();
  const [isReportOpen, setIsReportOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const { isCollapsed, toggleSidebar } = useSidebar();
  const { isAnyOffCanvasOpen } = useOffCanvas();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userRole, setUserRole] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const lastRoleRef = useRef<string>('');
  const isAuthPage = pathname === '/login' || pathname === '/register' || pathname === '/forgot-password';

  const fetchPermissions = useCallback(async (role: string) => {
    if (role === 'superadmin') {
      setPermissions([]);
      setLoading(false);
      return;
    }
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setPermissions([]);
        setLoading(false);
        return;
      }
      const res = await fetch(`http://localhost:5000/api/rbac/permissions?roleName=${role}&t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        cache: 'no-store'
      });
      
      if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        document.cookie = "token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        setPermissions([]);
        setUserRole('');
        router.push('/login');
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setPermissions(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  const syncAuth = useCallback(async () => {
    const userStr = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (!userStr || !token) {
      lastRoleRef.current = '';
      setUserRole('');
      setPermissions([]);
      setLoading(false);
      return;
    }

    try {
      const user = JSON.parse(userStr);
      const role = typeof user?.role === 'string' ? user.role : '';
      setUserRole(role);

      if (!role) {
        lastRoleRef.current = '';
        setPermissions([]);
        setLoading(false);
        return;
      }

      if (lastRoleRef.current !== role) {
        setLoading(true);
        lastRoleRef.current = role;
        await fetchPermissions(role);
        return;
      }

      if (permissions.length === 0 && role !== 'superadmin') {
        setLoading(true);
        await fetchPermissions(role);
      } else {
        setLoading(false);
      }
    } catch (e) {
      console.error("Error parsing user from local storage", e);
      lastRoleRef.current = '';
      setUserRole('');
      setPermissions([]);
      setLoading(false);
    }
  }, [fetchPermissions, permissions.length]);

  useEffect(() => {
    if (isAuthPage) {
      lastRoleRef.current = '';
      setUserRole('');
      setPermissions([]);
      setLoading(false);
      return;
    }
    syncAuth();
  }, [isAuthPage, pathname, syncAuth]);

  useEffect(() => {
    const onAuthChanged = () => {
      if (isAuthPage) return;
      syncAuth();
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'token' || e.key === 'user') onAuthChanged();
    };

    window.addEventListener('auth:changed', onAuthChanged);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('auth:changed', onAuthChanged);
      window.removeEventListener('storage', onStorage);
    };
  }, [isAuthPage, pathname, syncAuth]);

  // Auto collapse sidebar when any offcanvas opens
  // useEffect(() => {
  //   if (isAnyOffCanvasOpen) {
  //     setUserCollapsedState(isCollapsed);
  //     setIsCollapsed(true);
  //   } else {
  //     setIsCollapsed(userCollapsedState);
  //   }
  // }, [isAnyOffCanvasOpen]);

  // Update userCollapsedState when user manually toggles
  const handleToggleCollapse = () => {
    toggleSidebar();
  };

  const canShow = (module: string) => {
    if (loading) return false;
    if (userRole === 'superadmin') return true;
    const perm = permissions.find(p => p.module === module);
    return perm ? (perm.show || perm.create || perm.edit || perm.delete) : false;
  };

  if (isAuthPage) {
    return null;
  }

  const isActive = (path: string) => pathname === path;

  return (
    <div className={`${isCollapsed ? 'w-20' : 'w-72'} h-screen bg-white border-r border-gray-200 flex flex-col font-sans shrink-0 sticky top-0 transition-all duration-300`}>
      {/* Header */}
      <div className={`p-4 flex items-center ${isCollapsed ? 'justify-center flex-col gap-4' : 'justify-between'}`}>
        <div className="flex items-center gap-3">
            {/* Logo Icon */}
            <div className="text-pink-500 bg-pink-50 p-2 rounded-xl shrink-0">
                <Activity size={22} strokeWidth={2.5} />
            </div>
          {!isCollapsed && <span className="text-lg font-bold text-slate-800 leading-tight">Apotek Sumber Waras</span>}
        </div>
        <button 
            onClick={handleToggleCollapse}
            className="p-1.5 rounded-lg hover:bg-gray-100 border border-gray-200 text-gray-400 shrink-0"
        >
             {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Menu Items */}
      <div className="flex-1 overflow-y-auto py-2 px-3 space-y-1 custom-scrollbar">
        
        {userRole === 'superadmin' ? (
          <>
            {canShow('Management Pengguna') && (
                <NavItem href="/users" icon={<UserCheck size={20} />} label="Management Pengguna" active={isActive('/users')} isCollapsed={isCollapsed} />
            )}
            <div className={`pt-4 pb-2 px-3 ${isCollapsed ? 'text-center' : ''}`}>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{isCollapsed ? '...' : 'Others'}</span>
            </div>
            {canShow('System Settings') && (
            <div>
                <button 
                    onClick={() => {
                        if (isCollapsed) toggleSidebar();
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
            )}
          </>
        ) : (
          <>
            <NavItem href="/dashboard" icon={<LayoutDashboard size={20} />} label="Dashboards" active={isActive('/dashboard') || isActive('/')} isCollapsed={isCollapsed} />
            

            
            {canShow('Management Product') && (
                <NavItem href="/products" icon={<Package size={20} />} label="Products" active={isActive('/products')} isCollapsed={isCollapsed} />
            )}
            
            {canShow('Stock Opname') && (
                <NavItem href="/stock-opname" icon={<ClipboardCheck size={20} />} label="Stock Opname" active={isActive('/stock-opname')} isCollapsed={isCollapsed} />
            )}
            
            {canShow('Suppliers') && (
                <NavItem href="/suppliers" icon={<Users size={20} />} label="Suppliers" active={isActive('/suppliers')} isCollapsed={isCollapsed} />
            )}

            {canShow('Resep Dokter') && (
                <NavItem href="/prescriptions" icon={<FileText size={20} />} label="Resep Dokter" active={isActive('/prescriptions')} isCollapsed={isCollapsed} />
            )}
            
            {canShow('Transactions') && (
                <NavItem href="/transactions" icon={<ShoppingCart size={20} />} label="Transactions" active={isActive('/transactions')} isCollapsed={isCollapsed} />
            )}
            
            {canShow('Management Pengguna') && (
                <NavItem href="/users" icon={<UserCheck size={20} />} label="Management Pengguna" active={isActive('/users')} isCollapsed={isCollapsed} />
            )}
            
            {/* Expandable Menu */}
            {canShow('Sales Report') && (
            <div>
                <button 
                    onClick={() => {
                        if (isCollapsed) toggleSidebar();
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
                        <Link href="/reports/transactions" className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer ${isActive('/reports/transactions') ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:text-slate-700 hover:bg-gray-50'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isActive('/reports/transactions') ? 'bg-blue-600' : 'bg-transparent border border-slate-400'}`}></div>
                            <span className="font-medium text-sm">Laporan Transaksi</span>
                        </Link>
                        <Link href="/reports/general-ledger" className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer ${isActive('/reports/general-ledger') ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:text-slate-700 hover:bg-gray-50'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isActive('/reports/general-ledger') ? 'bg-blue-600' : 'bg-transparent border border-slate-400'}`}></div>
                            <span className="font-medium text-sm">Buku Besar</span>
                        </Link>
                    </div>
                )}
            </div>
            )}

            {canShow('Peramalan Stok') && (
                <NavItem href="/recommendations" icon={<Rocket size={20} />} label="Peramalan Stok" active={isActive('/recommendations')} isCollapsed={isCollapsed} />
            )}
            
            <div className={`pt-4 pb-2 px-3 ${isCollapsed ? 'text-center' : ''}`}>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{isCollapsed ? '...' : 'Others'}</span>
            </div>
            
            {canShow('System Settings') && (
            <div>
                <button 
                    onClick={() => {
                        if (isCollapsed) toggleSidebar();
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
                        <Link href="/settings/transaction-settings" className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer ${isActive('/settings/transaction-settings') ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:text-slate-700 hover:bg-gray-50'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isActive('/settings/transaction-settings') ? 'bg-blue-600' : 'bg-transparent border border-slate-400'}`}></div>
                            <span className="font-medium text-sm">Transactions Settings</span>
                        </Link>
                    </div>
                )}
            </div>
            )}
          </>
        )}

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
