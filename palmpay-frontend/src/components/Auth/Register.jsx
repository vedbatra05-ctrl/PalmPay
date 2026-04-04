/**
 * Register Page
 * =============
 * Registration form with name, email, password, and role selection.
 * Creates auth user + profile via Supabase trigger.
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signUp } from '../../services/authService';
import Button from '../UI/Button';
import './Auth.css';

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'customer',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Basic validation
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      await signUp(formData.email, formData.password, formData.name, formData.role);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
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

        {/* Register Form */}
        <form className="auth-form" onSubmit={handleSubmit}>
          <h2 className="auth-form-title">Create Account</h2>

          {/* Error Message */}
          {error && <div className="auth-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              placeholder="John Doe"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Min 6 characters"
              required
              autoComplete="new-password"
            />
          </div>

          {/* Role Selection */}
          <div className="form-group">
            <label>I am a</label>
            <div className="role-selector">
              <button
                type="button"
                className={`role-option ${formData.role === 'customer' ? 'active' : ''}`}
                onClick={() => setFormData({ ...formData, role: 'customer' })}
              >
                <span className="role-icon">👤</span>
                <span>Customer</span>
              </button>
              <button
                type="button"
                className={`role-option ${formData.role === 'merchant' ? 'active' : ''}`}
                onClick={() => setFormData({ ...formData, role: 'merchant' })}
              >
                <span className="role-icon">🏪</span>
                <span>Merchant</span>
              </button>
            </div>
          </div>

          <Button type="submit" fullWidth loading={loading}>
            Create Account
          </Button>

          <p className="auth-link">
            Already have an account?{' '}
            <Link to="/login">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
