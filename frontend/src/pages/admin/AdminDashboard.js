import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../../services/api';

const AdminDashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const response = await adminAPI.getAnalytics();
      setAnalytics(response.data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="container">
      <h1>Admin Dashboard</h1>

      <div style={{ marginBottom: '20px' }}>
        <Link to="/admin/products" className="btn btn-primary" style={{ marginRight: '10px' }}>
          Manage Products
        </Link>
        <Link to="/admin/users" className="btn btn-primary" style={{ marginRight: '10px' }}>
          Manage Users
        </Link>
        <Link to="/admin/settings" className="btn btn-primary">
          Settings
        </Link>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Users</h3>
          <div className="value">{analytics?.stats?.total_users || 0}</div>
        </div>
        <div className="stat-card">
          <h3>Total Clicks</h3>
          <div className="value">{analytics?.stats?.total_clicks || 0}</div>
        </div>
        <div className="stat-card">
          <h3>Total Purchases</h3>
          <div className="value">{analytics?.stats?.total_purchases || 0}</div>
        </div>
        <div className="stat-card">
          <h3>Points Redeemed</h3>
          <div className="value">{analytics?.stats?.total_points_redeemed || 0}</div>
        </div>
      </div>

      <div className="card">
        <h2>Top Referrers</h2>
        {analytics?.topReferrers && analytics.topReferrers.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Points</th>
                <th>Total Clicks</th>
              </tr>
            </thead>
            <tbody>
              {analytics.topReferrers.map((user, index) => (
                <tr key={index}>
                  <td>{user.email}</td>
                  <td>{user.points}</td>
                  <td>{user.click_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No data available</p>
        )}
      </div>

      <div className="card">
        <h2>Recent Purchases</h2>
        {analytics?.recentPurchases && analytics.recentPurchases.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Product</th>
                <th>Points</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {analytics.recentPurchases.map((purchase, index) => (
                <tr key={index}>
                  <td>{purchase.email}</td>
                  <td>{purchase.product_name}</td>
                  <td>{purchase.points_spent}</td>
                  <td>{new Date(purchase.purchased_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No purchases yet</p>
        )}
      </div>

      <div className="card">
        <h2>Recent Clicks</h2>
        {analytics?.recentClicks && analytics.recentClicks.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {analytics.recentClicks.map((click, index) => (
                <tr key={index}>
                  <td>{click.email}</td>
                  <td>{new Date(click.clicked_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No clicks yet</p>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
