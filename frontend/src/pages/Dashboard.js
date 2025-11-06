import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../services/api';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await userAPI.getReferralStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(stats.referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="container">
      <h1>Dashboard</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Points</h3>
          <div className="value">{user.points}</div>
        </div>
        <div className="stat-card">
          <h3>Total Clicks</h3>
          <div className="value">{stats?.totalClicks || 0}</div>
        </div>
      </div>

      <div className="card">
        <h2>Your Referral Link</h2>
        <p>Share this link to earn points! Each click gives you 1 point.</p>
        <div className="referral-link">
          <code>{stats?.referralUrl}</code>
          <button onClick={copyToClipboard} className="btn btn-primary">
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
