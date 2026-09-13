import { apiRequest } from './queryClient';

export interface AuthState {
  user: {
    id: number;
    anonName: string;
    status: string;
    createdAt: string;
  } | null;
  token: string | null;
  refreshToken: string | null;
  status: 'loading' | 'authenticated' | 'unauthenticated' | 'expired';
  tokenExpiresAt: number | null;
}

export interface AuthTokens {
  token: string;
  refreshToken: string;
}

const AUTH_STATE_KEY = 'chat_auth_state';
const TOKEN_REFRESH_THRESHOLD = 2 * 60; // Refresh 2 minutes before expiry (in seconds)

class AuthManager {
  private authState: AuthState = {
    user: null,
    token: null,
    refreshToken: null,
    status: 'loading',
    tokenExpiresAt: null
  };

  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshPromise: Promise<AuthTokens> | null = null;
  private listeners: ((state: AuthState) => void)[] = [];

  constructor() {
    this.loadFromStorage();
  }

  // Parse JWT and get expiry timestamp (in seconds)
  private getTokenExpiry(token: string): number | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1]));
      return payload.exp || null;
    } catch {
      return null;
    }
  }

  // Check if token is expired or about to expire
  private isTokenExpired(token: string, bufferSeconds: number = 0): boolean {
    const expiry = this.getTokenExpiry(token);
    if (!expiry) return true;
    const now = Math.floor(Date.now() / 1000);
    return expiry <= (now + bufferSeconds);
  }

  // Load auth state from localStorage
  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(AUTH_STATE_KEY);
      if (!stored) {
        this.authState.status = 'unauthenticated';
        return;
      }

      const parsedState = JSON.parse(stored);
      
      // Validate stored data
      if (!parsedState.token || !parsedState.refreshToken || !parsedState.user) {
        this.clearStorage();
        this.authState.status = 'unauthenticated';
        return;
      }

      // Check if access token is still valid (with 30 second buffer)
      if (!this.isTokenExpired(parsedState.token, 30)) {
        // Token is still valid
        const expiry = this.getTokenExpiry(parsedState.token);
        this.authState = { 
          ...parsedState, 
          status: 'authenticated',
          tokenExpiresAt: expiry ? expiry * 1000 : null
        };
        console.log('[Auth] Restored valid session from storage');
        this.scheduleTokenRefresh();
        return;
      }

      // Access token expired - check refresh token
      if (!this.isTokenExpired(parsedState.refreshToken)) {
        // Refresh token is valid, we'll refresh on first API call
        this.authState = { 
          ...parsedState, 
          status: 'authenticated', // Still authenticated, token will refresh automatically
          tokenExpiresAt: null
        };
        console.log('[Auth] Access token expired, refresh token valid - will refresh on demand');
        return;
      }

      // Both tokens expired
      console.log('[Auth] Session expired, need re-authentication');
      this.clearStorage();
      this.authState.status = 'expired';
      
    } catch (error) {
      console.error('[Auth] Failed to load auth state:', error);
      this.clearStorage();
      this.authState.status = 'unauthenticated';
    }
  }

  // Save auth state to localStorage
  private saveToStorage() {
    try {
      const toStore = {
        user: this.authState.user,
        token: this.authState.token,
        refreshToken: this.authState.refreshToken,
        tokenExpiresAt: this.authState.tokenExpiresAt
      };
      localStorage.setItem(AUTH_STATE_KEY, JSON.stringify(toStore));
    } catch (error) {
      console.error('[Auth] Failed to save auth state:', error);
    }
  }

  // Clear stored auth data
  private clearStorage() {
    try {
      localStorage.removeItem(AUTH_STATE_KEY);
    } catch (error) {
      console.error('[Auth] Failed to clear storage:', error);
    }
  }

  // Update auth state and notify listeners
  private updateAuthState(newState: Partial<AuthState>) {
    const prevState = { ...this.authState };
    this.authState = { ...this.authState, ...newState };
    
    // Save to storage if authenticated
    if (this.authState.token && this.authState.refreshToken && this.authState.user) {
      this.saveToStorage();
    } else if (!this.authState.token) {
      this.clearStorage();
    }

    // Notify listeners only if state changed
    if (JSON.stringify(prevState) !== JSON.stringify(this.authState)) {
      this.listeners.forEach(listener => listener(this.authState));
    }
  }

  // Schedule the next token refresh based on token expiry
  private scheduleTokenRefresh() {
    // Clear existing timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (!this.authState.token || !this.authState.refreshToken) {
      return;
    }

    const expiry = this.getTokenExpiry(this.authState.token);
    if (!expiry) {
      console.warn('[Auth] Could not determine token expiry');
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    // Refresh 2 minutes before expiry
    const refreshTime = expiry - TOKEN_REFRESH_THRESHOLD;
    const timeToRefresh = (refreshTime - now) * 1000;
    
    if (timeToRefresh <= 0) {
      // Already past refresh time, don't schedule (will refresh on next API call)
      console.log('[Auth] Token already needs refresh');
      return;
    }

    console.log(`[Auth] Scheduling token refresh in ${Math.round(timeToRefresh / 1000)}s`);
    
    this.refreshTimer = setTimeout(() => {
      console.log('[Auth] Scheduled refresh triggered');
      this.doRefreshToken().catch(error => {
        console.error('[Auth] Scheduled refresh failed:', error);
      });
    }, timeToRefresh);
  }

  // Set initial auth data (from login/dev auth)
  setAuthData(authData: {
    user: AuthState['user'];
    status: string;
    token: string;
    refreshToken: string;
  }) {
    const tokenExpiry = this.getTokenExpiry(authData.token);
    
    console.log('[Auth] Setting auth data', {
      userId: authData.user?.id,
      tokenExpiry: tokenExpiry ? new Date(tokenExpiry * 1000).toISOString() : null
    });
    
    this.updateAuthState({
      user: authData.user,
      token: authData.token,
      refreshToken: authData.refreshToken,
      status: 'authenticated',
      tokenExpiresAt: tokenExpiry ? tokenExpiry * 1000 : null
    });
    
    this.scheduleTokenRefresh();
  }

  // Get current auth state
  getAuthState(): AuthState {
    return { ...this.authState };
  }

  // Get current token for API requests - DOES NOT trigger refresh
  // Returns current token if valid, null if needs refresh
  getCurrentToken(): string | null {
    if (!this.authState.token) {
      return null;
    }
    
    // If token is expired or expiring soon, return null to signal need for refresh
    if (this.isTokenExpired(this.authState.token, 30)) {
      return null;
    }
    
    return this.authState.token;
  }

  // Get valid token - may trigger refresh if needed
  // This should only be called when actually making an API request
  async getValidToken(): Promise<string | null> {
    // If no token at all, return null
    if (!this.authState.token) {
      return null;
    }

    // If refresh is in progress, wait for it
    if (this.refreshPromise) {
      try {
        const tokens = await this.refreshPromise;
        return tokens.token;
      } catch {
        return null;
      }
    }

    // Check if token is still valid (with 30 second buffer)
    if (!this.isTokenExpired(this.authState.token, 30)) {
      return this.authState.token;
    }

    // Token is expired or expiring soon - try to refresh
    console.log('[Auth] Token needs refresh before API call');
    
    // Check if we can refresh
    if (!this.authState.refreshToken || this.isTokenExpired(this.authState.refreshToken)) {
      console.log('[Auth] Cannot refresh - refresh token missing or expired');
      this.updateAuthState({ status: 'expired' });
      return null;
    }

    try {
      const tokens = await this.doRefreshToken();
      return tokens.token;
    } catch {
      return null;
    }
  }

  // Internal refresh token method
  private async doRefreshToken(): Promise<AuthTokens> {
    // Prevent concurrent refresh calls
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    if (!this.authState.refreshToken) {
      throw new Error('No refresh token available');
    }

    // Check if refresh token is still valid
    if (this.isTokenExpired(this.authState.refreshToken)) {
      console.log('[Auth] Refresh token expired');
      this.updateAuthState({
        token: null,
        refreshToken: null,
        status: 'expired'
      });
      throw new Error('Refresh token expired');
    }

    console.log('[Auth] Starting token refresh');

    this.refreshPromise = (async () => {
      try {
        // Make direct fetch to avoid recursion through apiRequest
        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            refreshToken: this.authState.refreshToken
          }),
          credentials: 'include'
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Refresh failed: ${response.status} ${errorText}`);
        }
        
        const data = await response.json();
        const tokenExpiry = this.getTokenExpiry(data.token);

        console.log('[Auth] Token refresh successful');

        this.updateAuthState({
          user: data.user,
          token: data.token,
          refreshToken: data.refreshToken,
          status: 'authenticated',
          tokenExpiresAt: tokenExpiry ? tokenExpiry * 1000 : null
        });

        // Schedule next refresh
        this.scheduleTokenRefresh();

        return {
          token: data.token,
          refreshToken: data.refreshToken
        };
      } catch (error) {
        console.error('[Auth] Token refresh failed:', error);
        this.updateAuthState({
          token: null,
          refreshToken: null,
          status: 'expired'
        });
        throw error;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  // Public method for manual refresh
  async refreshToken(): Promise<AuthTokens> {
    return this.doRefreshToken();
  }

  // Revoke the server-side refresh session, then clear local credentials.
  async logout(): Promise<void> {
    const refreshToken = this.authState.refreshToken;

    try {
      if (refreshToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
          credentials: 'include'
        });
      }
    } catch (error) {
      console.warn('[Auth] Server-side logout failed; clearing local session', error);
    } finally {
      this.clearAuth();
    }
  }

  // Handle auth error (e.g., from WebSocket or API 401)
  async handleAuthError(): Promise<boolean> {
    console.log('[Auth] Handling auth error');
    
    // If already refreshing, wait for it
    if (this.refreshPromise) {
      try {
        await this.refreshPromise;
        return true;
      } catch {
        return false;
      }
    }
    
    // Try to refresh
    try {
      await this.doRefreshToken();
      return true;
    } catch {
      return false;
    }
  }

  // Subscribe to auth state changes
  subscribe(listener: (state: AuthState) => void) {
    this.listeners.push(listener);
    listener(this.authState);
    
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Clear all auth data (logout)
  clearAuth() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    
    this.refreshPromise = null;
    
    this.updateAuthState({
      user: null,
      token: null,
      refreshToken: null,
      status: 'unauthenticated',
      tokenExpiresAt: null
    });
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return this.authState.status === 'authenticated' && 
           !!this.authState.token && 
           !!this.authState.user;
  }

  // Check if session expired and needs re-authentication
  isSessionExpired(): boolean {
    return this.authState.status === 'expired';
  }

  // Cleanup
  cleanup() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.refreshPromise = null;
    this.listeners = [];
  }
}

// Create singleton instance
export const authManager = new AuthManager();

// React hook for using auth state
import { useState, useEffect } from 'react';

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>(authManager.getAuthState());

  useEffect(() => {
    const unsubscribe = authManager.subscribe(setAuthState);
    return unsubscribe;
  }, []);

  return {
    ...authState,
    doRefreshToken: () => authManager.refreshToken(),
    logout: () => authManager.logout(),
    getValidToken: () => authManager.getValidToken(),
    getCurrentToken: () => authManager.getCurrentToken(),
    handleAuthError: () => authManager.handleAuthError(),
    setAuthData: (data: Parameters<typeof authManager.setAuthData>[0]) => authManager.setAuthData(data),
    clearAuth: () => authManager.clearAuth(),
    isAuthenticated: () => authManager.isAuthenticated(),
    isSessionExpired: () => authManager.isSessionExpired(),
  };
}

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    authManager.cleanup();
  });
}
