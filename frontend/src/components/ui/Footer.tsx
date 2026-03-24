// Footer.tsx — Shared footer with links to legal pages, support, and social.

import { Link } from 'react-router-dom';
import { Brain, Mail } from 'lucide-react';
import { APP_NAME, APP_SUPPORT_EMAIL } from '@/constants';

export function Footer() {
  return (
    <footer className="border-t border-slate-200/60 bg-white py-6">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-[#3B82F6] to-[#06B6D4]">
              <Brain className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-dark-text">{APP_NAME}</span>
            <span className="text-xs text-slate-300 ml-1">&copy; {new Date().getFullYear()}</span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-5 text-xs text-slate-500">
            <Link to="/terms" className="hover:text-electric transition-colors">Terms of Service</Link>
            <Link to="/privacy" className="hover:text-electric transition-colors">Privacy Policy</Link>
            <a href={`mailto:${APP_SUPPORT_EMAIL}`} className="flex items-center gap-1 hover:text-electric transition-colors">
              <Mail className="h-3 w-3" /> Support
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
