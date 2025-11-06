import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AuthModal = ({ mode: initialMode, onClose }) => {
  const [mode, setMode] = useState(initialMode); // 'login' or 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'register') {
        await register(email, password);
      } else {
        await login(email, password);
      }
      onClose();
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ×
        </button>

        <div className="modal-header">
          <img
            src="https://danielpriestley.com/wp-content/uploads/2025/01/doac-daniel-priestley.png"
            alt="DOAC Logo"
            className="modal-logo"
          />
          <h2>Start Earning Points</h2>
          <div className="modal-tabs">
            <button
              className={`tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => setMode('login')}
            >
              Log in to your account
            </button>
            <button
              className={`tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => setMode('register')}
            >
              Create a free account
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="modal-input"
            />
          </div>

          <div className="form-group">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="modal-input"
            />
          </div>

          {error && <div className="modal-error">{error}</div>}

          <button
            type="submit"
            className="modal-submit"
            disabled={loading}
          >
            {loading ? 'Please wait...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthModal;
