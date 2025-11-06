import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="navbar">
      <div className="container">
        <div>
          <Link to="/" style={{ fontSize: '20px', fontWeight: 'bold' }}>
            Referral System
          </Link>
        </div>
        <div>
          {user ? (
            <>
              <Link to="/dashboard">Dashboard</Link>
              <Link to="/products">Products</Link>
              {isAdmin && <Link to="/admin">Admin</Link>}
              <span style={{ marginRight: '20px' }}>
                Points: {user.points}
              </span>
              <button onClick={handleLogout} className="btn btn-secondary">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/register">Register</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Navbar;
