'use client';

import { useEffect, useState } from 'react';
import { audioManager } from '@/app/utils/audioManager';

export function AudioInitializer() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    audioManager.init();
  }, []);

  // Don't render anything to avoid hydration issues
  if (!mounted) {
    return <></>;
  }

  return <></>;
}
