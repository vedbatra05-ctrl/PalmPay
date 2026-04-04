/**
 * Loader Component
 * ================
 * Full-screen loading spinner with optional message.
 */

import './Loader.css';

export default function Loader({ message = 'Loading...' }) {
  return (
    <div className="loader-overlay">
      <div className="loader-content">
        <div className="loader-ring">
          <div></div>
          <div></div>
          <div></div>
        </div>
        <p className="loader-message">{message}</p>
      </div>
    </div>
  );
}
