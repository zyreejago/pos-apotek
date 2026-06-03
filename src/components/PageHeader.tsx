"use client";

import { useEffect } from 'react';
import { useHeader } from '@/context/HeaderContext';

interface PageHeaderProps {
  title?: string;
  subtitle?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  rightContent?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, breadcrumbs, rightContent }: PageHeaderProps) {
  const { setHeaderState } = useHeader();

  useEffect(() => {
    setHeaderState({ title, subtitle, breadcrumbs, rightContent });

    // Clear header when component unmounts
    return () => setHeaderState({});
  }, [title, subtitle, breadcrumbs, rightContent, setHeaderState]);

  return null;
}
