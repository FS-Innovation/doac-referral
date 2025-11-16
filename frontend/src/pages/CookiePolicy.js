import './CookiePolicy.css';

const CookiePolicy = () => {
  return (
    <div className="policy-page">
      <div className="policy-container">
        <h1>Cookie Policy</h1>
        <p className="policy-updated">Last Updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

        <section className="policy-section">
          <h2>What Are Cookies?</h2>
          <p>
            Cookies are small text files stored on your device when you visit a website.
            They help the site remember your actions and preferences.
          </p>
        </section>

        <section className="policy-section">
          <h2>Cookies We Use</h2>
          <p>
            This website uses only strictly necessary cookies required for authentication.
            Under UK GDPR, these cookies do not require your consent as the site cannot function without them.
          </p>

          <div className="cookie-table">
            <table>
              <thead>
                <tr>
                  <th>Cookie Name</th>
                  <th>Purpose</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>auth_token</code></td>
                  <td>Keeps you securely logged in</td>
                  <td>7 days</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="policy-section">
          <h2>How We Protect Your Data</h2>
          <p>Our authentication cookies are secured with:</p>
          <ul>
            <li><strong>HttpOnly:</strong> Prevents JavaScript access, protecting against attacks</li>
            <li><strong>Secure:</strong> Only transmitted over encrypted HTTPS connections</li>
            <li><strong>SameSite:</strong> Prevents cross-site attacks</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Managing Cookies</h2>
          <p>
            You can delete cookies through your browser settings. However, doing so will log you out
            and you'll need to sign in again.
          </p>
        </section>

        <section className="policy-section">
          <h2>Third-Party Cookies</h2>
          <p>
            We do not use any third-party cookies for advertising, analytics, or tracking.
          </p>
        </section>

        <div className="policy-footer">
          <div className="policy-links">
            <a href="/">← Back to Home</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookiePolicy;
