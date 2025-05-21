// Use the auth middleware from the main auth file 
import { isAuthenticated as mainIsAuthenticated } from '../../middleware/auth';

/**
 * For consistent authentication handling across API routes
 * Re-export the main middleware 
 */
export const isAuthenticated = mainIsAuthenticated; 