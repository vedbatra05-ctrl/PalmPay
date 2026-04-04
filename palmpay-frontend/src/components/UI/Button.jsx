/**
 * Button Component
 * ================
 * Styled button with loading state support.
 * Variants: primary (default), secondary, danger
 */

import './Button.css';

export default function Button({
  children,
  onClick,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = false,
  type = 'button',
}) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} ${fullWidth ? 'btn-full' : ''}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? (
        <span className="btn-loader">
          <span className="spinner"></span>
          Processing...
        </span>
      ) : (
        children
      )}
    </button>
  );
}
