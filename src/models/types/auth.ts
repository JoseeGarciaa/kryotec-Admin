export interface UserSecurity {
  mustChangePassword?: boolean;
  passwordExpiresAt?: string | null;
  passwordExpired?: boolean;
  passwordChangedAt?: string | null;
  sessionTimeoutMinutes?: number;
  failedAttempts?: number;
  isLocked?: boolean;
  lockoutUntil?: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role?: string;
  avatar?: string;
  security?: UserSecurity;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}