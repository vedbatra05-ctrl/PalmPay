/**
 * ProtectedRoute Component
 * ========================
 * Wraps dashboard routes. Redirects to /login if not authenticated.
 * Shows loader while auth state is being determined.
 */

import { Navigate } from 'react-router-dom';
import Loader from '../UI/Loader';

export default function ProtectedRoute({ children, isAuthenticated, loading }) {
  if (loading) {
    return <Loader message="Verifying session..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
