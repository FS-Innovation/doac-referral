import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import InterestSelector from '../components/profile/InterestSelector';
import GenderSelector from '../components/profile/GenderSelector';
import DOBInput from '../components/profile/DOBInput';
import PhoneInput from '../components/profile/PhoneInput';
import MarketingPreferences from '../components/profile/MarketingPreferences';
import { profileAPI, experimentAPI, authAPI } from '../services/api';
import './ProfileCompletion.css';

const ProfileCompletion = () => {
  const { user, emailVerified, refreshUser } = useAuth();
  const navigate = useNavigate();

  // Form state
  const [phone, setPhone] = useState('');
  const [interests, setInterests] = useState([]);
  const [gender, setGender] = useState('');
  const [dobVariant, setDobVariant] = useState(null);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [marketingPrefs, setMarketingPrefs] = useState([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [passwordResetSent, setPasswordResetSent] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  // Edit mode for individual sections
  const [editingSection, setEditingSection] = useState(null); // 'phone', 'interests', 'gender', 'dob', 'marketing'

  // Available options (loaded from API)
  const [availableInterests, setAvailableInterests] = useState([]);
  const [availableChannels, setAvailableChannels] = useState([]);

  useEffect(() => {
    if (user && !emailVerified) {
      navigate('/confirm-email');
      return;
    }
    loadOptionsAndProfile();
  }, [user, emailVerified, navigate]);

  const loadOptionsAndProfile = async () => {
    try {
      const [interestsRes, channelsRes, variantRes, profileRes] = await Promise.all([
        profileAPI.getInterests(),
        profileAPI.getMarketingChannels(),
        experimentAPI.getVariant('dob_input_type'),
        profileAPI.getProfile()
      ]);

      setAvailableInterests(interestsRes.data.interests);
      setAvailableChannels(channelsRes.data.channels);
      setDobVariant(variantRes.data.variant);

      const profile = profileRes.data.profile;
      if (profile) {
        if (profile.phone) setPhone(profile.phone);
        if (profile.interests?.length) setInterests(profile.interests);
        if (profile.gender) setGender(profile.gender);
        if (profile.dateOfBirth) setDateOfBirth(profile.dateOfBirth);
        if (profile.ageRange) setAgeRange(profile.ageRange);
        if (profile.marketingPreferences?.length) setMarketingPrefs(profile.marketingPreferences);
        if (profile.dobVariant) setDobVariant(profile.dobVariant);
      }
    } catch (err) {
      console.error('Error loading profile options:', err);
      setError('Failed to load options. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSection = async (section) => {
    setSubmitting(true);
    setError('');

    try {
      const profileData = {
        phone: phone || undefined,
        interests,
        gender: gender || undefined,
        dobVariant,
        dateOfBirth: dobVariant === 'date_picker' ? dateOfBirth : undefined,
        ageRange: dobVariant === 'age_range' ? ageRange : undefined,
        marketingPreferences: marketingPrefs
      };

      await profileAPI.updateProfile(profileData);
      await refreshUser();
      setEditingSection(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAll = async () => {
    setSubmitting(true);
    setError('');

    try {
      const profileData = {
        phone: phone || undefined,
        interests,
        gender: gender || undefined,
        dobVariant,
        dateOfBirth: dobVariant === 'date_picker' ? dateOfBirth : undefined,
        ageRange: dobVariant === 'age_range' ? ageRange : undefined,
        marketingPreferences: marketingPrefs
      };

      await profileAPI.updateProfile(profileData);
      await refreshUser();
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;

    setSendingReset(true);
    try {
      await authAPI.forgotPassword(user.email);
      setPasswordResetSent(true);
    } catch (err) {
      setError('Failed to send password reset email. Please try again.');
    } finally {
      setSendingReset(false);
    }
  };

  // Helper to check if a field has data
  const hasPhone = !!phone;
  const hasInterests = interests.length > 0;
  const hasGender = !!gender;
  const hasDOB = !!dateOfBirth || !!ageRange;
  const hasMarketing = marketingPrefs.length > 0;

  // Get display values
  const getInterestNames = () => {
    return interests
      .map(id => availableInterests.find(i => i.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  };

  const getMarketingNames = () => {
    return marketingPrefs
      .map(id => availableChannels.find(c => c.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  };

  const formatDOB = () => {
    if (dateOfBirth) {
      return new Date(dateOfBirth).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    }
    if (ageRange) return ageRange;
    return '';
  };

  // Render a filled field with edit button
  const renderFilledField = (label, value, section) => (
    <div className="profile-field filled">
      <div className="field-header">
        <span className="field-label">{label}</span>
        <button
          className="edit-btn"
          onClick={() => setEditingSection(section)}
        >
          Edit
        </button>
      </div>
      <div className="field-value">{value}</div>
    </div>
  );

  // Render an editable field in edit mode
  const renderEditingField = (label, content, section) => (
    <div className="profile-field editing">
      <div className="field-header">
        <span className="field-label">{label}</span>
      </div>
      <div className="field-content">
        {content}
      </div>
      <div className="field-actions">
        <button
          className="cancel-btn"
          onClick={() => setEditingSection(null)}
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          className="save-btn"
          onClick={() => handleSaveSection(section)}
          disabled={submitting}
        >
          {submitting ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="profile-completion-page">
        <div className="profile-loading">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Separate filled and empty fields
  const filledFields = [];
  const emptyFields = [];

  // Phone
  if (hasPhone && editingSection !== 'phone') {
    filledFields.push({ key: 'phone', label: 'Phone', value: phone, section: 'phone' });
  } else {
    emptyFields.push({ key: 'phone', section: 'phone' });
  }

  // Interests
  if (hasInterests && editingSection !== 'interests') {
    filledFields.push({ key: 'interests', label: 'Interests', value: getInterestNames(), section: 'interests' });
  } else {
    emptyFields.push({ key: 'interests', section: 'interests' });
  }

  // Gender
  if (hasGender && editingSection !== 'gender') {
    filledFields.push({ key: 'gender', label: 'Gender', value: gender, section: 'gender' });
  } else {
    emptyFields.push({ key: 'gender', section: 'gender' });
  }

  // DOB
  if (hasDOB && editingSection !== 'dob') {
    filledFields.push({ key: 'dob', label: 'Date of Birth', value: formatDOB(), section: 'dob' });
  } else {
    emptyFields.push({ key: 'dob', section: 'dob' });
  }

  // Marketing
  if (hasMarketing && editingSection !== 'marketing') {
    filledFields.push({ key: 'marketing', label: 'Marketing Preferences', value: getMarketingNames(), section: 'marketing' });
  } else {
    emptyFields.push({ key: 'marketing', section: 'marketing' });
  }

  return (
    <div className="profile-completion-page">
      <div className="profile-completion-container">
        <div className="profile-header">
          <h1>Your Profile</h1>
          <p className="subtitle">Manage your information and preferences</p>
        </div>

        {error && (
          <div className="profile-error">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            {error}
          </div>
        )}

        <div className="profile-columns">
          {/* Left Column - Your Profile (account info + filled data) */}
          <div className="profile-column filled-column">
            <div className="column-header">
              <h2>Your Profile</h2>
              <span className="column-badge">Account</span>
            </div>

            <div className="fields-list">
              {/* Account Info - Always shown */}
              <div className="profile-field filled account-field">
                <div className="field-header">
                  <span className="field-label">Name</span>
                </div>
                <div className="field-value">{user?.name || 'Not set'}</div>
              </div>

              <div className="profile-field filled account-field">
                <div className="field-header">
                  <span className="field-label">Email</span>
                </div>
                <div className="field-value">{user?.email}</div>
              </div>

              <div className="profile-field filled account-field">
                <div className="field-header">
                  <span className="field-label">Password</span>
                  {!passwordResetSent ? (
                    <button
                      className="edit-btn"
                      onClick={handlePasswordReset}
                      disabled={sendingReset}
                    >
                      {sendingReset ? 'Sending...' : 'Change'}
                    </button>
                  ) : null}
                </div>
                <div className="field-value">
                  {passwordResetSent ? (
                    <span className="password-reset-sent">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                      </svg>
                      Reset link sent to your email
                    </span>
                  ) : (
                    '••••••••'
                  )}
                </div>
              </div>

              {/* Divider between account and profile info */}
              {filledFields.length > 0 && <div className="fields-divider" />}

              {/* Other filled profile fields */}
              {filledFields.map(field => (
                editingSection === field.section ? (
                  <div key={field.key}>
                    {field.section === 'phone' && renderEditingField('Phone',
                      <PhoneInput value={phone} onChange={setPhone} />, 'phone')}
                    {field.section === 'interests' && renderEditingField('Interests',
                      <InterestSelector options={availableInterests} selected={interests} onChange={setInterests} />, 'interests')}
                    {field.section === 'gender' && renderEditingField('Gender',
                      <GenderSelector value={gender} onChange={setGender} />, 'gender')}
                    {field.section === 'dob' && renderEditingField('Date of Birth',
                      <DOBInput variant={dobVariant} dateValue={dateOfBirth} onDateChange={setDateOfBirth} ageRangeValue={ageRange} onAgeRangeChange={setAgeRange} />, 'dob')}
                    {field.section === 'marketing' && renderEditingField('Marketing Preferences',
                      <MarketingPreferences channels={availableChannels} selected={marketingPrefs} onChange={setMarketingPrefs} />, 'marketing')}
                  </div>
                ) : (
                  <div key={field.key}>
                    {renderFilledField(field.label, field.value, field.section)}
                  </div>
                )
              ))}
            </div>
          </div>

          {/* Right Column - Add Information (empty fields) */}
          <div className="profile-column empty-column">
            <div className="column-header">
              <h2>Add Information</h2>
              <span className="column-badge optional">Optional</span>
            </div>

            {emptyFields.length > 0 ? (
              <div className="fields-list">
                {emptyFields.map(field => (
                  <div key={field.key} className="profile-field empty-field">
                    {field.section === 'phone' && (
                      <>
                        <div className="field-label">Phone</div>
                        <PhoneInput value={phone} onChange={setPhone} />
                      </>
                    )}
                    {field.section === 'interests' && (
                      <>
                        <div className="field-label">Interests</div>
                        <InterestSelector options={availableInterests} selected={interests} onChange={setInterests} />
                      </>
                    )}
                    {field.section === 'gender' && (
                      <>
                        <div className="field-label">Gender</div>
                        <GenderSelector value={gender} onChange={setGender} />
                      </>
                    )}
                    {field.section === 'dob' && (
                      <>
                        <div className="field-label">Date of Birth</div>
                        <DOBInput variant={dobVariant} dateValue={dateOfBirth} onDateChange={setDateOfBirth} ageRangeValue={ageRange} onAgeRangeChange={setAgeRange} />
                      </>
                    )}
                    {field.section === 'marketing' && (
                      <>
                        <div className="field-label">Marketing Preferences</div>
                        <MarketingPreferences channels={availableChannels} selected={marketingPrefs} onChange={setMarketingPrefs} />
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state complete">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <p>Profile complete!</p>
              </div>
            )}
          </div>
        </div>

        {/* Save All Button */}
        <div className="profile-actions">
          <button
            className="save-all-btn"
            onClick={handleSaveAll}
            disabled={submitting}
          >
            {submitting ? 'Saving...' : 'Save & Return to Dashboard'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileCompletion;
