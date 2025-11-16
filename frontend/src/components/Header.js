import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './Header.css';

const Header = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="app-header">
      <div className="header-container">
        {/* Logo - Always visible */}
        <div className="header-logo">
          <img
            src="https://storage.googleapis.com/doac-perks/e4e508a04084eee9320c875b55dca2cec34de30b.png"
            alt="DOAC Logo"
            className="logo-image"
          />
        </div>

        {/* Points and Logout - Only visible when authenticated */}
        {isAuthenticated && (
          <div className="header-right">
            <div className="points-pill">
              Points: {user?.points || 0}
            </div>
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
