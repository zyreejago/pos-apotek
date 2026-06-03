"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const token = localStorage.getItem('token');
    const isLoginPage = pathname === '/login';
    const isRegisterPage = pathname === '/register';
    const isForgotPasswordPage = pathname === '/forgot-password';

    if (!token && !isLoginPage && !isRegisterPage && !isForgotPasswordPage) {
      router.push('/login');
    }

    if (token && (isLoginPage || isRegisterPage || isForgotPasswordPage)) {
      router.push('/dashboard');
    }
  }, [pathname, router, mounted]);

  // Prevent flash of protected content
  // If we are not on login page and no token, show nothing until redirect
  if (mounted && typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    const isLoginPage = pathname === '/login';
    const isRegisterPage = pathname === '/register';
    const isForgotPasswordPage = pathname === '/forgot-password';
    
    if (!token && !isLoginPage && !isRegisterPage && !isForgotPasswordPage) {
        return null; // Or a loading spinner
    }
  }

  return <>{children}</>;
}
