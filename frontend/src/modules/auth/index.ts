// modules/auth/index.ts
// Public API of the auth module. Import from here only — never from internal files.
// PORTABILITY: Copy the entire 'auth/' folder to any React project and import from its index.

// Types
export type { User, LoginRequest, RegisterRequest, AuthTokens } from './types/auth.types';

// Constants
export { AUTH_ROUTES, USER_ROLES, ROLE_LABELS } from './constants/auth.constants';

// Store
export { useAuthStore } from './store/auth.store';

// Hooks (REACT NATIVE READY — no DOM dependencies)
export { useAuth } from './hooks/useAuth';
export { useAuthForm } from './hooks/useAuthForm';

// Service
export { authService } from './services/auth.service';

// Components
export { AuthGuard } from './components/AuthGuard';
export { RoleGuard } from './components/RoleGuard';
export { UserAvatar } from './components/UserAvatar';

// Pages
export { LoginPage } from './pages/LoginPage';
export { RegisterPage } from './pages/RegisterPage';
export { ForgotPasswordPage } from './pages/ForgotPasswordPage';
export { ResetPasswordPage } from './pages/ResetPasswordPage';
