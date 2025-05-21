'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { UserRole } from '@/lib/types';

interface ProtectedRouteProps {
  children: ReactNode;
  roles?: UserRole[];
  skipRoleCheck?: boolean; // Added to avoid redirecting from profile page itself
  allowNoRole?: boolean; // Added to allow pages like blockchain to be viewed without specific role
}

export function ProtectedRoute({ 
  children, 
  roles = [], 
  skipRoleCheck = false,
  allowNoRole = false 
}: ProtectedRouteProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      // Check for various authentication sources
      const walletToken = localStorage.getItem('walletAuthToken') || localStorage.getItem('web3AuthToken');
      const walletUserData = localStorage.getItem('walletUserData');
      const walletAddress = localStorage.getItem('walletAddress');
      const fallbackAuthToken = localStorage.getItem('fallbackAuthToken');
      const fallbackUserData = localStorage.getItem('fallbackUserData');
      
      const hasWalletAuth = !!walletToken && !!walletUserData;
      const hasConnectedWallet = !!walletAddress;
      const hasFallbackAuth = !!fallbackAuthToken && !!fallbackUserData;
      
      console.log('ProtectedRoute: Checking auth sources', { 
        nextAuth: status, 
        walletAuth: hasWalletAuth,
        fallbackAuth: hasFallbackAuth,
        connectedWallet: hasConnectedWallet,
        session: session ? 'exists' : 'none',
        walletToken: walletToken ? 'exists' : 'none',
        walletUserData: walletUserData ? 'exists' : 'none',
        walletAddress: walletAddress ? 'exists' : 'none',
        fallbackAuthToken: fallbackAuthToken ? 'exists' : 'none'
      });

      // Cek untuk wallet yang belum terdaftar (ada token tapi tidak ada userData)
      if (walletToken && !walletUserData) {
        console.warn('ProtectedRoute: Token exists but user data is missing - redirecting to wallet registration');
        // Arahkan ke halaman registrasi wallet daripada membuat userData default
        localStorage.setItem('pendingWalletRegistration', 'true');
        if (walletAddress) {
          localStorage.setItem('pendingWalletAddress', walletAddress);
        }
        // Simpan token sementara untuk proses registrasi
        localStorage.setItem('tempWalletToken', walletToken);
        // Hapus token autentikasi karena belum selesai registrasi
        localStorage.removeItem('walletAuthToken');
        localStorage.removeItem('web3AuthToken');
        
        // Redirect ke halaman registrasi wallet
        router.push('/auth/register/wallet');
        return;
      }

      // If using NextAuth session
      if (status === 'authenticated' && session) {
        // Store session in sessionStorage for API client
        const sessionData = {
          user: session.user,
          accessToken: session.accessToken
        };
        sessionStorage.setItem('session', JSON.stringify(sessionData));
      }
      // Also check for fallback authentication
      else if (hasFallbackAuth) {
        try {
          const userData = JSON.parse(fallbackUserData || '{}');
          // Store as a session-like structure in sessionStorage for API client
          const sessionData = {
            user: userData,
            accessToken: fallbackAuthToken
          };
          sessionStorage.setItem('session', JSON.stringify(sessionData));
          console.log('ProtectedRoute: Using fallback authentication', sessionData);
        } catch (error) {
          console.error('Error parsing fallback user data:', error);
        }
      }

      // Check if the user is loading
      if (status === 'loading' && !hasWalletAuth && !hasFallbackAuth) {
        console.log('ProtectedRoute: Authentication status is loading');
        return;
      }

      // If the user is not authenticated via NextAuth, wallet, or fallback
      if (status === 'unauthenticated' && !hasWalletAuth && !hasFallbackAuth) {
        const isAuthPage = window.location.pathname.includes('/auth/login') || 
                          window.location.pathname.includes('/auth/register');
        
        if (!isAuthPage) {
          console.log('ProtectedRoute: User is not authenticated, redirecting to login');
          router.push('/auth/login');
          return;
        }
      }

      // Get user role from any available authentication source
      let userRole = session?.user?.role;
      let needsRoleSelection = session?.user?.needsRoleSelection;
      
      // Try to get from wallet auth if needed
      if (!userRole && hasWalletAuth) {
        try {
          const userData = JSON.parse(walletUserData || '{}');
          userRole = userData.role;
          console.log('ProtectedRoute: Got userRole from wallet:', userRole);
          needsRoleSelection = false;
          
          // Jika userRole tidak valid, coba tetapkan nilai default
          if (!userRole || typeof userRole !== 'string' || !Object.values(UserRole).includes(userRole as UserRole)) {
            console.warn('ProtectedRoute: Invalid role from wallet, using FARMER as default');
            userRole = UserRole.FARMER;
            // Update localStorage with valid role
            userData.role = UserRole.FARMER;
            localStorage.setItem('walletUserData', JSON.stringify(userData));
          }
        } catch (e) {
          console.error('Error parsing wallet user data:', e);
        }
      }

      // Skip role check if requested
      if (skipRoleCheck) {
        setAuthChecked(true);
        return;
      }

      const stringRole = String(userRole || '').toUpperCase();
      const isValidRole = stringRole && stringRole !== 'UNDEFINED' && stringRole !== 'NULL' && stringRole !== 'UNKNOWN';

      // Check if user needs to select a role
      if ((!isValidRole || needsRoleSelection) && !allowNoRole) {
        setAuthError('Please complete your profile and select a role before continuing.');
        router.push('/profile');
        return;
      }
      
      // Check required roles
      if (roles.length > 0) {
        const hasRequiredRole = userRole && roles.includes(userRole as UserRole);
        if (!hasRequiredRole) {
          setAuthError('You do not have permission to access this page.');
          router.push('/');
          return;
        }
      }

      setAuthChecked(true);
      setAuthError(null);
    };

    checkAuth();
  }, [session, status, router, roles, skipRoleCheck, allowNoRole]);

  // Show loading or the actual content
  if (status === 'loading' || !authChecked) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] text-green-600 motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
          <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Loading...</span>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    // Check if wallet auth or fallback auth is present before returning null
    const walletToken = localStorage.getItem('walletAuthToken') || localStorage.getItem('web3AuthToken');
    const walletUserData = localStorage.getItem('walletUserData');
    const fallbackToken = localStorage.getItem('fallbackAuthToken');
    const fallbackUserData = localStorage.getItem('fallbackUserData');
    
    // Check if user is in the process of wallet registration
    const pendingWalletRegistration = localStorage.getItem('pendingWalletRegistration');
    const isWalletRegPath = window.location.pathname.includes('/auth/register/wallet');
    
    if (pendingWalletRegistration && !isWalletRegPath) {
      console.log('ProtectedRoute: Wallet registration is pending, redirecting to wallet registration');
      router.push('/auth/register/wallet');
      return null;
    }
    
    if ((walletToken && walletUserData) || (fallbackToken && fallbackUserData)) {
      console.log('ProtectedRoute: NextAuth shows unauthenticated but alternative auth exists');
      // Return children since alternative auth is valid
      return <>{children}</>;
    }
    
    return null;
  }

  if (authError) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen p-4">
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 p-4 mb-6 max-w-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700 dark:text-yellow-200">{authError}</p>
            </div>
          </div>
        </div>
        <button 
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
        >
          Go to Home
        </button>
      </div>
    );
  }
  
  return <>{children}</>;
}
