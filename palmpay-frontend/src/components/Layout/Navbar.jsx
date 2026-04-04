/**
 * Navbar Component
 * ================
 * Top navigation bar with logo, user info, role badge, and logout.
 */

import { useNavigate } from 'react-router-dom';
import { signOut } from '../../services/authService';
import './Navbar.css';

export default function Navbar({ profile }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Brand */}
        <div className="navbar-brand" onClick={() => navigate('/dashboard')}>
          <span className="navbar-logo">🖐️</span>
          <span className="navbar-title">PalmPay</span>
        </div>

        {/* User Info */}
        {profile && (
          <div className="navbar-user">
            <div className="navbar-user-info">
              <span className="navbar-user-name">{profile.name}</span>
              <span className={`navbar-role-badge role-${profile.role}`}>
                {profile.role}
              </span>
            </div>
            <button className="navbar-logout" onClick={handleLogout}>
              Sign Out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
