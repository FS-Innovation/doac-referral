import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';

const Settings = () => {
  const [redirectUrl, setRedirectUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await adminAPI.getSettings();
      setRedirectUrl(response.data.redirectUrl);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    try {
      await adminAPI.updateRedirectUrl(redirectUrl);
      setMessage({ type: 'success', text: 'Redirect URL updated successfully' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Update failed' });
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="container">
      <h1>Settings</h1>

      <div className="card">
        <h2>Global Redirect URL</h2>
        <p>This is the URL where all referral links will redirect to after tracking the click.</p>

        {message.text && (
          <div className={message.type === 'success' ? 'success' : 'error'}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Redirect URL *</label>
            <input
              type="url"
              value={redirectUrl}
              onChange={(e) => setRedirectUrl(e.target.value)}
              placeholder="https://example.com"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary">
            Update Redirect URL
          </button>
        </form>
      </div>

      <div className="card">
        <h2>How It Works</h2>
        <p>When someone clicks on a user's referral link (e.g., <code>/r/ABC123</code>):</p>
        <ol style={{ marginLeft: '20px', marginTop: '10px' }}>
          <li>The system records the click with IP address and user agent</li>
          <li>The user earns 1 point</li>
          <li>The visitor is redirected to the URL configured above</li>
        </ol>
      </div>
    </div>
  );
};

export default Settings;
