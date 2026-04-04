/**
 * Login Page
 * ==========
 * Email/password login form with error handling and loading states.
 * Redirects to dashboard on successful login.
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signIn } from '../../services/authService';
import Button from '../UI/Button';
import './Auth.css';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        {/* Brand Header */}
        <div className="auth-header">
          <span className="auth-logo">🖐️</span>
          <h1 className="auth-title">PalmPay</h1>
          <p className="auth-subtitle">Biometric Touchless Payments</p>
        </div>

        {/* Login Form */}
        <form className="auth-form" onSubmit={handleSubmit}>
          <h2 className="auth-form-title">Welcome Back</h2>

          {/* Error Message */}
          {error && <div className="auth-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <Button type="submit" fullWidth loading={loading}>
            Sign In
          </Button>

          <p className="auth-link">
            Don&apos;t have an account?{' '}
            <Link to="/register">Create one</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
