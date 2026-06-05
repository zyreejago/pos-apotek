import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Permission {
  module: string;
  create: boolean | number | string;
  edit: boolean | number | string;
  delete: boolean | number | string;
  show: boolean | number | string;
}

export function useRequirePermission(moduleName: string) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');

  useEffect(() => {
    const check = async () => {
      const userStr = localStorage.getItem('user');
      const token = localStorage.getItem('token');
      
      if (!userStr || !token) {
        document.cookie = "token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        router.push('/login');
        return;
      }
      
      try {
        const user = JSON.parse(userStr);
        setCurrentUserRole(user.role);
        
        // Superadmin bypass for critical settings access
        if (user.role === 'superadmin' && (moduleName === 'Role & Permission' || moduleName === 'Transaction Setting')) {
          setHasPermission(true);
          setLoading(false);
          return;
        }

        const res = await fetch(`http://localhost:5000/api/rbac/permissions?roleName=${user.role}&t=${Date.now()}`, {
          headers: { 'Authorization': `Bearer ${token}` },
          cache: 'no-store'
        });
        
        if (res.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          document.cookie = "token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          router.push('/login');
          return;
        }

        if (res.ok) {
            const data: Permission[] = await res.json();
            setPermissions(data);
            const perm = data.find((p) => p.module === moduleName);
            // Strict boolean check for 'show' permission
            if (perm && (perm.show === true || perm.show === 1 || perm.show === '1')) {
                setHasPermission(true);
            } else {
                setHasPermission(false);
                router.push('/dashboard'); // Redirect to dashboard if access denied
            }
        } else {
             console.error("Failed to fetch permissions");
             router.push('/dashboard');
        }
      } catch (e) {
        console.error("Error checking permissions", e);
        router.push('/dashboard');
      } finally {
        setLoading(false);
      }
    };
    check();
  }, [moduleName, router]);

  const checkActionPermission = (action: 'create' | 'edit' | 'delete' | 'show') => {
    if (loading) return false;
    
    // Superadmin has full access to critical settings
    if (currentUserRole === 'superadmin' && (moduleName === 'Role & Permission' || moduleName === 'Transaction Setting')) return true;
    
    const perm = permissions.find(p => p.module === moduleName);
    const hasPerm = perm ? (perm[action] === true || perm[action] === 1 || perm[action] === '1') : false;

    // Fallback: If no permissions found in DB for superadmin, give them access anyway (to prevent total lockout)
    // but if permissions exist, they must follow them.
    if (currentUserRole === 'superadmin' && permissions.length === 0) return true;
    
    return hasPerm;
  };

  return { loading, hasPermission, permissions, checkActionPermission, currentUserRole };
}
