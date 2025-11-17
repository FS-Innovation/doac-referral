import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = ({ children, adminOnly = false }) => {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  // CRITICAL FIX: Validate user object has required data (not just truthy)
  // Prevents access with incomplete/invalid user state
  const isValidUser = user &&
                      user.id &&
                      user.email &&
                      user.referralCode &&
                      typeof user.points === 'number';

  if (!isValidUser) {
    console.log('Invalid or incomplete user session, redirecting to login');
    return <Navigate to="/" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default PrivateRoute;
