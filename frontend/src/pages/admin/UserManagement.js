import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await adminAPI.getAllUsers();
      setUsers(response.data.users);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="container">
      <h1>User Management</h1>

      <div className="card">
        <h2>All Users</h2>
        {users.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Referral Code</th>
                <th>Points</th>
                <th>Total Clicks</th>
                <th>Total Purchases</th>
                <th>Admin</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td><code>{user.referralCode}</code></td>
                  <td>{user.points}</td>
                  <td>{user.totalClicks}</td>
                  <td>{user.totalPurchases}</td>
                  <td>{user.isAdmin ? 'Yes' : 'No'}</td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No users found</p>
        )}
      </div>
    </div>
  );
};

export default UserManagement;
