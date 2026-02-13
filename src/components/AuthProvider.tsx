"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const token = localStorage.getItem('token');
    const isLoginPage = pathname === '/login';

    if (!token && !isLoginPage) {
      router.push('/login');
    }

    if (token && isLoginPage) {
      router.push('/dashboard');
    }
  }, [pathname, router, mounted]);

  // Prevent flash of protected content
  // If we are not on login page and no token, show nothing until redirect
  if (mounted && typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    const isLoginPage = pathname === '/login';
    
    if (!token && !isLoginPage) {
        return null; // Or a loading spinner
    }
  }

  return <>{children}</>;
}
