/**
 * Auth0Provider Wrapper for common-react
 * 
 * Wraps the Auth0Provider from @auth0/auth0-react with proper configuration
 */

import React from 'react';
import { Auth0Provider as Auth0ProviderBase } from '@auth0/auth0-react';
import type { Auth0Config } from '../../types/auth0';

interface AuthProviderProps {
  children: React.ReactNode;
  config: Auth0Config;
}

/**
 * Check if the current origin is secure (HTTPS or localhost)
 * Auth0 requires a secure origin for Web Crypto API
 */
function isSecureOrigin(): boolean {
  if (typeof window === 'undefined') {
    return false; // SSR
  }
  const origin = window.location.origin;
  // HTTPS is always secure
  if (origin.startsWith('https://')) {
    return true;
  }
  // localhost is allowed for development
  if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
    return true;
  }
  // HTTP on other domains is not secure
  return false;
}

/**
 * Auth0Provider component
 * Wraps the application with Auth0 authentication
 * 
 * For HTTP (non-localhost) origins, this component will skip Auth0 initialization
 * and render children directly, allowing the app to work without authentication.
 * 
 * @example
 * ```tsx
 * <AuthProvider config={{
 *   domain: 'your-tenant.auth0.com',
 *   clientId: 'your-client-id',
 *   audience: 'https://your-api.com'
 * }}>
 *   <App />
 * </AuthProvider>
 * ```
 */
/**
 * Determines if the application is using IAM Service for authentication
 * IAM Service is indicated when redirect URI points to /auth/callback
 */
function isUsingIAMService(config: Auth0Config): boolean {
  const redirectUri = config.redirectUri || (typeof window !== 'undefined' ? window.location.origin + '/callback' : '');
  return redirectUri.includes('/auth/callback');
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, config }) => {
  // Check if we're on a secure origin
  const secure = isSecureOrigin();
  
  // Check if Auth0 configuration is provided
  const hasAuth0Config = config.domain && config.clientId;
  
  // Check if app is using IAM Service (BFF pattern)
  // When using IAM Service, Auth0 SDK is not needed as IAM handles all OAuth flows
  const usingIAMService = isUsingIAMService(config);
  
  // Skip Auth0 SDK initialization if:
  // 1. App is using IAM Service (redirect URI points to /auth/callback)
  // 2. Auth0 config is missing (app uses alternative auth method)
  if (usingIAMService || !hasAuth0Config) {
    // This is expected and correct when using IAM Service
    // IAM Service handles all OAuth flows, so Auth0 SDK is not needed
    if (process.env.NODE_ENV === 'development' && usingIAMService) {
      console.info(
        'ℹ️  Auth0 Provider skipped: App is using IAM Service for authentication. ' +
        'IAM Service handles OAuth flows, so Auth0 SDK initialization is not needed.'
      );
    }
    return <>{children}</>;
  }
  
  // For HTTP (non-localhost), skip Auth0 initialization
  // Auth0 requires HTTPS or localhost for Web Crypto API
  if (!secure) {
    console.warn(
      '⚠️  Auth0 disabled: App is running on HTTP (non-localhost). ' +
      'Auth0 requires HTTPS or localhost. The app will work without authentication.'
    );
    return <>{children}</>;
  }
  
  // Initialize Auth0 SDK for apps that use Auth0 directly (not IAM Service)
  return (
    <Auth0ProviderBase
      domain={config.domain}
      clientId={config.clientId}
      authorizationParams={{
        redirect_uri: config.redirectUri || window.location.origin + '/callback',
        audience: config.audience,
        // Include offline_access scope to enable refresh tokens
        // This allows the SDK to obtain and use refresh tokens for silent authentication
        // Default scope includes: openid (required), profile, email, offline_access (for refresh tokens)
        scope: config.scope || 'openid profile email offline_access',
      }}
      cacheLocation="localstorage"
      useRefreshTokens={true}
    >
      {children}
    </Auth0ProviderBase>
  );
};

