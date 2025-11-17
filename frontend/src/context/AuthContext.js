import { createContext, useState, useContext, useEffect, useRef } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

// Session storage keys for persistence
const SESSION_STORAGE_KEY = 'auth_session_backup';
const SESSION_TIMESTAMP_KEY = 'auth_session_timestamp';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef(false); // Prevent duplicate requests
  const retryTimeoutRef = useRef(null); // For retry mechanism
  const retryCountRef = useRef(0); // Track retry attempts
  const MAX_RETRIES = 3; // Maximum retry attempts

  useEffect(() => {
    // Skip auth check on referral redirect pages (e.g., /r/abc123)
    // These users aren't logged in and just need to be redirected to the video
    const isReferralRedirect = window.location.pathname.startsWith('/r/');

    if (!isReferralRedirect) {
      // Try to load user from cookie
      loadUser();
    } else {
      // Immediately set loading to false for referral pages
      setLoading(false);
    }

    // Cleanup retry timeout on unmount
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const loadUser = async () => {
    // Prevent duplicate calls (React Strict Mode + multiple component mounts)
    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      const response = await authAPI.getProfile();
      const userData = response.data;

      // FAANG-level: Validate response has required fields
      if (!userData || !userData.id || !userData.email || !userData.referralCode) {
        console.error('Invalid user data received from server');
        setUser(null);
        clearSessionBackup();
        return;
      }

      setUser(userData);

      // Reset retry counter on successful auth
      retryCountRef.current = 0;

      // Store backup in sessionStorage (survives page refresh, cleared on tab close)
      saveSessionBackup(userData);
    } catch (error) {
      // CRITICAL: Distinguish between different error types
      if (error.response?.status === 429) {
        console.warn('⚠️  Rate limit hit during auth check - attempting session recovery');

        // Try to recover session from backup
        const recoveredSession = recoverSessionFromBackup();
        if (recoveredSession) {
          console.log('✅ Session recovered from backup');
          setUser(recoveredSession);

          // Retry with exponential backoff (but only up to MAX_RETRIES times)
          if (retryCountRef.current < MAX_RETRIES) {
            retryCountRef.current += 1;
            const backoffDelay = Math.min(5000 * Math.pow(2, retryCountRef.current - 1), 30000); // 5s, 10s, 20s (max 30s)
            console.log(`Retrying auth check in ${backoffDelay / 1000}s (attempt ${retryCountRef.current}/${MAX_RETRIES})...`);

            retryTimeoutRef.current = setTimeout(() => {
              loadingRef.current = false;
              loadUser();
            }, backoffDelay);
          } else {
            console.warn('⚠️  Max retries reached - using cached session');
            // Don't retry anymore, just use the cached session
            retryCountRef.current = 0; // Reset for next time
          }
        } else {
          console.error('❌ No session backup available, user must re-login');
          setUser(null);
          retryCountRef.current = 0;
        }
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        // 401/403 = NOT an error - just means user isn't logged in yet
        // This is NORMAL and EXPECTED on landing page - silently handle
        setUser(null);
        clearSessionBackup();
      } else {
        // Network error or other issue - try session recovery
        console.error('Auth check failed (network/server error):', error.message);
        const recoveredSession = recoverSessionFromBackup();
        if (recoveredSession) {
          console.log('✅ Using cached session due to network error');
          setUser(recoveredSession);
        } else {
          setUser(null);
        }
      }
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  // FAANG-level: Session backup for resilience
  const saveSessionBackup = (userData) => {
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(userData));
      sessionStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());
    } catch (error) {
      console.warn('Failed to save session backup:', error);
    }
  };

  const recoverSessionFromBackup = () => {
    try {
      const backupData = sessionStorage.getItem(SESSION_STORAGE_KEY);
      const timestamp = sessionStorage.getItem(SESSION_TIMESTAMP_KEY);

      if (!backupData || !timestamp) return null;

      // Only use backup if it's less than 1 hour old
      const age = Date.now() - parseInt(timestamp, 10);
      const MAX_AGE = 60 * 60 * 1000; // 1 hour

      if (age > MAX_AGE) {
        console.log('Session backup expired, clearing...');
        clearSessionBackup();
        return null;
      }

      const userData = JSON.parse(backupData);

      // Validate backup has required fields
      if (!userData || !userData.id || !userData.email || !userData.referralCode) {
        console.warn('Invalid session backup data');
        clearSessionBackup();
        return null;
      }

      return userData;
    } catch (error) {
      console.warn('Failed to recover session backup:', error);
      return null;
    }
  };

  const clearSessionBackup = () => {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      sessionStorage.removeItem(SESSION_TIMESTAMP_KEY);
    } catch (error) {
      console.warn('Failed to clear session backup:', error);
    }
  };

  const login = async (email, password) => {
    const response = await authAPI.login(email, password);
    const userData = response.data.user;

    // Validate user data before setting state
    if (!userData || !userData.id || !userData.email || !userData.referralCode) {
      throw new Error('Invalid user data received from server');
    }

    setUser(userData);
    saveSessionBackup(userData);
    return response.data;
  };

  const register = async (email, password) => {
    const response = await authAPI.register(email, password);
    const userData = response.data.user;

    // Validate user data before setting state
    if (!userData || !userData.id || !userData.email || !userData.referralCode) {
      throw new Error('Invalid user data received from server');
    }

    setUser(userData);
    saveSessionBackup(userData);
    return response.data;
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      clearSessionBackup();
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.isAdmin || false
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
