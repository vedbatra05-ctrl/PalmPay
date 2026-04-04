/**
 * App Component
 * =============
 * Root component with routing logic.
 * Routes:
 *   /login    → Login page
 *   /register → Register page
 *   /dashboard → Customer or Merchant dashboard (role-based)
 *   /         → Redirect to /dashboard or /login
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import CustomerDashboard from './components/Dashboard/CustomerDashboard';
import MerchantDashboard from './components/Dashboard/MerchantDashboard';
import Navbar from './components/Layout/Navbar';
import ProtectedRoute from './components/Layout/ProtectedRoute';
import Loader from './components/UI/Loader';

export default function App() {
  const { session, profile, loading, isAuthenticated, refreshProfile } = useAuth();

  // Show loader while checking auth state
  if (loading) {
    return <Loader message="Starting PalmPay..." />;
  }

  return (
    <Router>
      <div className="app">
        {/* Show Navbar only when authenticated */}
        {isAuthenticated && profile && <Navbar profile={profile} />}

        <Routes>
          {/* Public Routes */}
          <Route
            path="/login"
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
            }
          />
          <Route
            path="/register"
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register />
            }
          />

          {/* Protected Dashboard Route */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated} loading={loading}>
                {profile?.role === 'merchant' ? (
                  <MerchantDashboard profile={profile} refreshProfile={refreshProfile} />
                ) : (
                  <CustomerDashboard profile={profile} refreshProfile={refreshProfile} />
                )}
              </ProtectedRoute>
            }
          />

          {/* Default Redirect */}
          <Route
            path="*"
            element={
              <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />
            }
          />
        </Routes>
      </div>
    </Router>
  );
}
