// CrispChat.tsx — Crisp live chat widget loader.
// Get your website ID from crisp.chat and set it in constants/app.ts

import { useEffect } from 'react';
import { CRISP_WEBSITE_ID } from '@/constants';

declare global {
  interface Window {
    $crisp?: unknown[];
    CRISP_WEBSITE_ID?: string;
  }
}

export function CrispChat() {
  useEffect(() => {
    if (!CRISP_WEBSITE_ID) return; // Skip if no ID configured

    // Prevent double-loading
    if (window.$crisp) return;

    window.$crisp = [];
    window.CRISP_WEBSITE_ID = CRISP_WEBSITE_ID;

    const script = document.createElement('script');
    script.src = 'https://client.crisp.chat/l.js';
    script.async = true;
    document.head.appendChild(script);

    return () => {
      // Cleanup on unmount (unlikely in practice)
      script.remove();
    };
  }, []);

  return null; // This component renders nothing — it just loads the script
}
