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
  Activity,
  Search,
  CheckCircle,
  RotateCcw
} from 'lucide-react';
import { useSidebar } from '@/context/SidebarContext';
import { useOffCanvas } from '@/context/OffCanvasContext';

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
  const [isReturnsOpen, setIsReturnsOpen] = useState(true);
  const { isCollapsed, toggleSidebar, setIsCollapsed, userCollapsedState, setUserCollapsedState } = useSidebar();
  const { isAnyOffCanvasOpen } = useOffCanvas();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userRole, setUserRole] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const lastRoleRef = useRef<string>('');
  const isAuthPage = pathname === '/login' || pathname === '/register' || pathname === '/forgot-password';

  const fetchPermissions = useCallback(async (role: string) => {
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
    } catch (error) {
      console.error(error);
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

  const handleToggleCollapse = () => {
    const newState = !isCollapsed;
    toggleSidebar();
    setUserCollapsedState(newState);
  };

  const canShow = (module: string) => {
    if (loading) return false;
    // Dashboard is usually visible to everyone once logged in
    if (module === 'Dashboards') return true;
    
    // Superadmin bypass for critical settings access
    if (userRole === 'superadmin' && (module === 'Role & Permission' || module === 'System Setting')) return true;
    
    const perm = permissions.find(p => p.module === module);
    const hasPerm = perm ? (perm.show || perm.create || perm.edit || perm.delete) : false;

    // Fallback: If superadmin has no permissions set in DB yet, show everything
    if (userRole === 'superadmin' && permissions.length === 0) return true;
    
    return hasPerm;
  };

  // Auto-collapse sidebar when offcanvas opens, but allow manual toggle
  const prevOffCanvasRef = useRef(isAnyOffCanvasOpen);
  useEffect(() => {
    if (isAuthPage) return;
    
    if (isAnyOffCanvasOpen && !prevOffCanvasRef.current) {
      // Offcanvas just opened — save user's original state and collapse
      setUserCollapsedState(isCollapsed);
      setIsCollapsed(true);
    } else if (!isAnyOffCanvasOpen && prevOffCanvasRef.current) {
      // Offcanvas just closed — restore user's original state
      setIsCollapsed(userCollapsedState);
    }
    prevOffCanvasRef.current = isAnyOffCanvasOpen;
  }, [isAnyOffCanvasOpen, isAuthPage, setIsCollapsed, setUserCollapsedState, userCollapsedState]);

  if (isAuthPage) {
    return null;
  }

  const isActive = (path: string) => pathname === path;

  return (
    <div className={`${isCollapsed ? 'w-20' : 'w-72'} h-screen bg-white border-r border-gray-200 flex flex-col font-sans shrink-0 sticky top-0 transition-all duration-300`}>
      {/* Header */}
      <div className={`relative flex items-center ${isCollapsed ? 'flex-col justify-center pt-3 pb-1 gap-2' : 'justify-center pt-0 pb-0 -mb-7'}`}>
        <div className="shrink-0">
          <img src="/logo.png" alt="Logo" className={`object-contain ${isCollapsed ? 'w-12 h-12' : 'w-28 h-28'}`} />
        </div>
        {!isCollapsed && (
          <button
            onClick={handleToggleCollapse}
            className="absolute right-3 p-1.5 rounded-lg hover:bg-gray-100 border border-gray-200 text-gray-400 shrink-0"
          >
            <ChevronLeft size={16} />
          </button>
        )}
        {isCollapsed && (
          <button
            onClick={handleToggleCollapse}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0"
          >
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      {/* Menu Items */}
      <div className="flex-1 overflow-y-auto py-2 px-3 space-y-1 custom-scrollbar">
        
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

        {canShow('Riwayat Pembelian') && (
          <NavItem href="/purchase-history" icon={<Repeat size={20} />} label="Riwayat Pembelian" active={isActive('/purchase-history')} isCollapsed={isCollapsed} />
        )}

        {(canShow('Retur Pembelian') || canShow('Retur Penjualan')) && (
          <div>
            <button
              onClick={() => {
                if (isCollapsed) toggleSidebar();
                setIsReturnsOpen(!isReturnsOpen);
              }}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-3 py-2.5 rounded-lg transition-colors group ${pathname.startsWith('/purchase-returns') || pathname.startsWith('/sale-returns') ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
              title={isCollapsed ? "Retur" : ""}
            >
              <div className="flex items-center gap-3">
                <span className={`group-hover:text-slate-600 ${pathname.startsWith('/purchase-returns') || pathname.startsWith('/sale-returns') ? 'text-slate-600' : 'text-slate-400'}`}>
                  <RotateCcw size={20} />
                </span>
                {!isCollapsed && <span className={`font-medium ${pathname.startsWith('/purchase-returns') || pathname.startsWith('/sale-returns') ? 'text-slate-800' : 'text-slate-600'}`}>Retur</span>}
              </div>
              {!isCollapsed && <span className="text-slate-400 text-lg leading-none">{isReturnsOpen ? '−' : '+'}</span>}
            </button>

            {isReturnsOpen && !isCollapsed && (
              <div className="ml-4 mt-1 space-y-1 border-l border-gray-100 pl-2">
                {canShow('Retur Pembelian') && (
                  <Link href="/purchase-returns" className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer ${isActive('/purchase-returns') ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:text-slate-700 hover:bg-gray-50'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${isActive('/purchase-returns') ? 'bg-blue-600' : 'bg-transparent border border-slate-400'}`}></div>
                    <span className="font-medium text-sm">Retur Pembelian</span>
                  </Link>
                )}
                {canShow('Retur Penjualan') && (
                  <Link href="/sale-returns" className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer ${isActive('/sale-returns') ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:text-slate-700 hover:bg-gray-50'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${isActive('/sale-returns') ? 'bg-blue-600' : 'bg-transparent border border-slate-400'}`}></div>
                    <span className="font-medium text-sm">Retur Penjualan</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {canShow('Approval Faktur') && (
          <NavItem href="/approvals" icon={<CheckCircle size={20} />} label="Approval Faktur" active={isActive('/approvals')} isCollapsed={isCollapsed} />
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
                <Link href="/reports/general-journal" className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer ${isActive('/reports/general-journal') ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:text-slate-700 hover:bg-gray-50'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${isActive('/reports/general-journal') ? 'bg-blue-600' : 'bg-transparent border border-slate-400'}`}></div>
                  <span className="font-medium text-sm">Jurnal Umum</span>
                </Link>
                <Link href="/reports/financial-transactions" className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer ${isActive('/reports/financial-transactions') ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:text-slate-700 hover:bg-gray-50'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${isActive('/reports/financial-transactions') ? 'bg-blue-600' : 'bg-transparent border border-slate-400'}`}></div>
                  <span className="font-medium text-sm">Transaksi Keuangan</span>
                </Link>
              </div>
            )}
          </div>
        )}

        {canShow('Peramalan Stok') && (
          <NavItem href="/recommendations" icon={<Rocket size={20} />} label="Peramalan Stok" active={isActive('/recommendations')} isCollapsed={isCollapsed} />
        )}
        
        {canShow('Audit Trail') && (
          <NavItem href="/audit-trails" icon={<Activity size={20} />} label="Audit Trail" active={isActive('/audit-trails')} isCollapsed={isCollapsed} />
        )}
        
        <div className={`pt-4 pb-2 px-3 ${isCollapsed ? 'text-center' : ''}`}>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{isCollapsed ? '...' : 'Others'}</span>
        </div>
        
        {/* Merge permissions: show System Settings if user has access to either child */}
        {(canShow('Role & Permission') || canShow('Transaction Setting')) && (
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
                  <span className="font-medium text-sm">Role & Permission</span>
                </Link>
                <Link href="/settings/transaction-settings" className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer ${isActive('/settings/transaction-settings') ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:text-slate-700 hover:bg-gray-50'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${isActive('/settings/transaction-settings') ? 'bg-blue-600' : 'bg-transparent border border-slate-400'}`}></div>
                  <span className="font-medium text-sm">Transaction Setting</span>
                </Link>
              </div>
            )}
          </div>
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
  );
}
