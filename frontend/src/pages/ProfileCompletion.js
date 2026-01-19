import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import InterestSelector from '../components/profile/InterestSelector';
import GenderSelector from '../components/profile/GenderSelector';
import DOBInput from '../components/profile/DOBInput';
import PhoneInput from '../components/profile/PhoneInput';
import MarketingPreferences from '../components/profile/MarketingPreferences';
import { profileAPI, experimentAPI, authAPI } from '../services/api';
import {
  trackProfileViewed,
  trackProfileUpdated,
  trackProfileCompleted,
  trackPasswordResetRequested,
  trackExperimentViewed,
} from '../services/analytics';
import './ProfileCompletion.css';

const ProfileCompletion = () => {
  const { user, emailVerified, refreshUser } = useAuth();
  const navigate = useNavigate();

  // Saved profile data (what's actually persisted)
  const [savedProfile, setSavedProfile] = useState({
    name: '',
    phone: '',
    interests: [],
    gender: '',
    dateOfBirth: '',
    ageRange: '',
    marketingPrefs: []
  });

  // Current form state (may have unsaved changes)
  const [name, setName] = useState('');
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
  const [successMessage, setSuccessMessage] = useState('');
  const [passwordResetSent, setPasswordResetSent] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [resetCooldown, setResetCooldown] = useState(0);

  // Edit mode for filled fields
  const [editingSection, setEditingSection] = useState(null);

  // Focus states for floating labels
  const [nameFocused, setNameFocused] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);

  // Available options (loaded from API)
  const [availableInterests, setAvailableInterests] = useState([]);
  const [availableChannels, setAvailableChannels] = useState([]);

  // Check if there are unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    return (
      name !== savedProfile.name ||
      phone !== savedProfile.phone ||
      JSON.stringify(interests) !== JSON.stringify(savedProfile.interests) ||
      gender !== savedProfile.gender ||
      dateOfBirth !== savedProfile.dateOfBirth ||
      ageRange !== savedProfile.ageRange ||
      JSON.stringify(marketingPrefs) !== JSON.stringify(savedProfile.marketingPrefs)
    );
  }, [name, phone, interests, gender, dateOfBirth, ageRange, marketingPrefs, savedProfile]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Cooldown timer effect
  useEffect(() => {
    if (resetCooldown > 0) {
      const timer = setTimeout(() => setResetCooldown(resetCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resetCooldown]);

  // Check localStorage for previous reset attempt
  useEffect(() => {
    const lastReset = localStorage.getItem('lastPasswordReset');
    if (lastReset) {
      const elapsed = Math.floor((Date.now() - parseInt(lastReset)) / 1000);
      const cooldownTime = 60;
      if (elapsed < cooldownTime) {
        setResetCooldown(cooldownTime - elapsed);
        setPasswordResetSent(true);
      }
    }
  }, []);

  useEffect(() => {
    if (user && !emailVerified) {
      navigate('/confirm-email');
      return;
    }
    trackProfileViewed();
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

      // Track A/B test variant assignment
      if (variantRes.data.variant) {
        trackExperimentViewed('dob_input_type', variantRes.data.variant);
      }

      const profile = profileRes.data.profile;
      // Name comes from profile API (firstName) or user context (name)
      const userName = profile?.firstName || user?.name || '';

      // Set both saved and current state
      const loadedProfile = {
        name: userName,
        phone: profile?.phone || '',
        interests: profile?.interests || [],
        gender: profile?.gender || '',
        dateOfBirth: profile?.dateOfBirth || '',
        ageRange: profile?.ageRange || '',
        marketingPrefs: profile?.marketingPreferences || []
      };

      setSavedProfile(loadedProfile);
      setName(loadedProfile.name);
      setPhone(loadedProfile.phone);
      setInterests(loadedProfile.interests);
      setGender(loadedProfile.gender);
      setDateOfBirth(loadedProfile.dateOfBirth);
      setAgeRange(loadedProfile.ageRange);
      setMarketingPrefs(loadedProfile.marketingPrefs);

      if (profile?.dobVariant) setDobVariant(profile.dobVariant);
    } catch (err) {
      console.error('Error loading profile options:', err);
      setError('Failed to load options. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSubmitting(true);
    setError('');
    setSuccessMessage('');

    try {
      const profileData = {
        firstName: name || undefined,
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

      // Track which fields were updated
      const updatedFields = [];
      if (name !== savedProfile.name) updatedFields.push('name');
      if (phone !== savedProfile.phone) updatedFields.push('phone');
      if (JSON.stringify(interests) !== JSON.stringify(savedProfile.interests)) updatedFields.push('interests');
      if (gender !== savedProfile.gender) updatedFields.push('gender');
      if (dateOfBirth !== savedProfile.dateOfBirth) updatedFields.push('dateOfBirth');
      if (ageRange !== savedProfile.ageRange) updatedFields.push('ageRange');
      if (JSON.stringify(marketingPrefs) !== JSON.stringify(savedProfile.marketingPrefs)) updatedFields.push('marketingPreferences');

      if (updatedFields.length > 0) {
        trackProfileUpdated(updatedFields);
      }

      // Check if profile is now complete (all main fields filled)
      const isComplete = name && (interests.length > 0);
      if (isComplete && (!savedProfile.name || savedProfile.interests.length === 0)) {
        trackProfileCompleted(100);
      }

      // Update saved profile state
      setSavedProfile({
        name,
        phone,
        interests: [...interests],
        gender,
        dateOfBirth,
        ageRange,
        marketingPrefs: [...marketingPrefs]
      });

      setEditingSection(null);
      setSuccessMessage('Changes saved successfully');

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAndReturn = async () => {
    if (!hasUnsavedChanges()) {
      navigate('/dashboard');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const profileData = {
        firstName: name || undefined,
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
      setSubmitting(false);
    }
  };

  const handleDiscard = () => {
    // Reset to saved values
    setName(savedProfile.name);
    setPhone(savedProfile.phone);
    setInterests([...savedProfile.interests]);
    setGender(savedProfile.gender);
    setDateOfBirth(savedProfile.dateOfBirth);
    setAgeRange(savedProfile.ageRange);
    setMarketingPrefs([...savedProfile.marketingPrefs]);
    setEditingSection(null);
    setError('');
  };

  const handlePasswordReset = useCallback(async () => {
    if (!user?.email || sendingReset || resetCooldown > 0) return;

    setSendingReset(true);
    setError('');

    try {
      await authAPI.forgotPassword(user.email);
      trackPasswordResetRequested(user.email);
      setPasswordResetSent(true);
      setResetCooldown(60);
      localStorage.setItem('lastPasswordReset', Date.now().toString());
    } catch (err) {
      if (err.response?.status === 429) {
        const retryAfter = err.response?.data?.retryAfter || 3600;
        setError(`Too many password reset requests. Please try again in ${Math.ceil(retryAfter / 60)} minutes.`);
        setResetCooldown(Math.min(retryAfter, 300));
      } else {
        setError('Failed to send password reset email. Please try again.');
      }
    } finally {
      setSendingReset(false);
    }
  }, [user?.email, sendingReset, resetCooldown]);

  // Check if fields have SAVED data (for determining which column)
  const hasSavedName = !!savedProfile.name;
  const hasSavedPhone = !!savedProfile.phone;
  const hasSavedInterests = savedProfile.interests.length > 0;
  const hasSavedGender = !!savedProfile.gender;
  const hasSavedDOB = !!savedProfile.dateOfBirth || !!savedProfile.ageRange;
  const hasSavedMarketing = savedProfile.marketingPrefs.length > 0;

  // Get display values for saved data (backend uses slugs, not ids)
  const getInterestNames = (interestSlugs) => {
    return interestSlugs
      .map(slug => availableInterests.find(i => i.slug === slug)?.display_name)
      .filter(Boolean)
      .join(', ');
  };

  const getMarketingNames = (marketingSlugs) => {
    return marketingSlugs
      .map(slug => availableChannels.find(c => c.slug === slug)?.display_name)
      .filter(Boolean)
      .join(', ');
  };

  const formatDOB = (dob, range) => {
    if (dob) {
      return new Date(dob).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    }
    if (range) return range;
    return '';
  };

  // Render a filled field with edit button (shows SAVED data)
  const renderFilledField = (label, value, section) => (
    <div key={section} className="profile-field filled">
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
    <div key={section} className="profile-field editing">
      <div className="field-header">
        <span className="field-label">{label}</span>
      </div>
      <div className="field-content">
        {content}
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

  // Build filled fields list (based on SAVED data)
  const filledFields = [];
  if (hasSavedName) filledFields.push({ key: 'name', label: 'Name', value: savedProfile.name, section: 'name' });
  if (hasSavedPhone) filledFields.push({ key: 'phone', label: 'Phone', value: savedProfile.phone, section: 'phone' });
  if (hasSavedInterests) filledFields.push({ key: 'interests', label: 'Interests', value: getInterestNames(savedProfile.interests), section: 'interests' });
  if (hasSavedGender) filledFields.push({ key: 'gender', label: 'Gender', value: savedProfile.gender, section: 'gender' });
  if (hasSavedDOB) filledFields.push({ key: 'dob', label: 'Date of Birth', value: formatDOB(savedProfile.dateOfBirth, savedProfile.ageRange), section: 'dob' });
  if (hasSavedMarketing) filledFields.push({ key: 'marketing', label: 'Marketing Preferences', value: getMarketingNames(savedProfile.marketingPrefs), section: 'marketing' });

  // Build empty fields list (based on SAVED data)
  const emptyFields = [];
  if (!hasSavedName) emptyFields.push({ key: 'name', section: 'name' });
  if (!hasSavedPhone) emptyFields.push({ key: 'phone', section: 'phone' });
  if (!hasSavedInterests) emptyFields.push({ key: 'interests', section: 'interests' });
  if (!hasSavedGender) emptyFields.push({ key: 'gender', section: 'gender' });
  if (!hasSavedDOB) emptyFields.push({ key: 'dob', section: 'dob' });
  if (!hasSavedMarketing) emptyFields.push({ key: 'marketing', section: 'marketing' });

  // Render name input with floating label for empty column
  const renderNameInputFloating = () => (
    <div className={`profile-floating-label ${nameFocused || name ? 'focused' : ''}`}>
      <div className="profile-input-wrapper">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={() => setNameFocused(true)}
          onBlur={() => setNameFocused(false)}
          className="profile-input"
        />
        <label className="profile-floating-label-text">Name</label>
      </div>
    </div>
  );

  // Render name input for edit mode (no floating label needed)
  const renderNameInput = () => (
    <input
      type="text"
      value={name}
      onChange={(e) => setName(e.target.value)}
      placeholder="Enter your name"
      className="name-input"
    />
  );

  // Render phone input with floating label for empty column
  const renderPhoneInputFloating = () => (
    <div className={`profile-floating-label ${phoneFocused || phone ? 'focused' : ''}`}>
      <div className="profile-input-wrapper">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onFocus={() => setPhoneFocused(true)}
          onBlur={() => setPhoneFocused(false)}
          placeholder=""
          autoComplete="tel"
          className="profile-input"
        />
        <label className="profile-floating-label-text">Phone Number</label>
      </div>
      <p className="profile-input-hint">Include country code (e.g., +44 for UK)</p>
    </div>
  );

  const unsavedChanges = hasUnsavedChanges();

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

        {successMessage && (
          <div className="profile-success">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            {successMessage}
          </div>
        )}

        <div className={`profile-columns ${emptyFields.length === 0 ? 'single-column' : ''}`}>
          {/* Left Column - Your Profile (account info + SAVED data) */}
          <div className={`profile-column filled-column ${emptyFields.length === 0 ? 'centered' : ''}`}>
            <div className="column-header">
              <h2>Your Profile</h2>
              <span className="column-badge">Account</span>
            </div>

            <div className="fields-list">
              {/* Email - Always shown, not editable */}
              <div className="profile-field filled account-field">
                <div className="field-header">
                  <span className="field-label">Email</span>
                </div>
                <div className="field-value">{user?.email}</div>
              </div>

              {/* Password */}
              <div className="profile-field filled account-field">
                <div className="field-header">
                  <span className="field-label">Password</span>
                  {!passwordResetSent && resetCooldown === 0 ? (
                    <button
                      className="edit-btn"
                      onClick={handlePasswordReset}
                      disabled={sendingReset}
                    >
                      {sendingReset ? 'Sending...' : 'Change'}
                    </button>
                  ) : resetCooldown > 0 ? (
                    <span className="cooldown-text">{resetCooldown}s</span>
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

              {/* Filled profile fields - show SAVED data or editing form */}
              {filledFields.map(field => {
                // Interests and Marketing always show as interactive selectors (not text)
                if (field.section === 'interests') {
                  return (
                    <div key={field.key} className="profile-field filled">
                      <div className="field-header">
                        <span className="field-label">Interests</span>
                      </div>
                      <div className="field-content">
                        <InterestSelector options={availableInterests} selected={interests} onChange={setInterests} hideLabel />
                      </div>
                    </div>
                  );
                }
                if (field.section === 'marketing') {
                  return (
                    <div key={field.key} className="profile-field filled">
                      <div className="field-header">
                        <span className="field-label">Marketing Preferences</span>
                      </div>
                      <div className="field-content">
                        <MarketingPreferences channels={availableChannels} selected={marketingPrefs} onChange={setMarketingPrefs} hideLabel />
                      </div>
                    </div>
                  );
                }

                // Other fields use edit button pattern
                return editingSection === field.section ? (
                  <div key={field.key}>
                    {field.section === 'name' && renderEditingField('Name', renderNameInput(), 'name')}
                    {field.section === 'phone' && renderEditingField('Phone',
                      <PhoneInput value={phone} onChange={setPhone} hideLabel />, 'phone')}
                    {field.section === 'gender' && renderEditingField('Gender',
                      <GenderSelector value={gender} onChange={setGender} hideLabel />, 'gender')}
                    {field.section === 'dob' && renderEditingField('Date of Birth',
                      <DOBInput variant={dobVariant} dateValue={dateOfBirth} onDateChange={setDateOfBirth} ageRangeValue={ageRange} onAgeRangeChange={setAgeRange} hideLabel />, 'dob')}
                  </div>
                ) : (
                  renderFilledField(field.label, field.value, field.section)
                );
              })}

              {filledFields.length === 0 && (
                <div className="empty-state">
                  <p>Add some information to personalize your profile</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Add Information (empty fields) - Only show when there are empty fields */}
          {emptyFields.length > 0 && (
            <div className="profile-column empty-column">
              <div className="column-header">
                <h2>Add Information</h2>
                <span className="column-badge optional">Optional</span>
              </div>

              <div className="fields-list">
                {emptyFields.map(field => (
                  <div key={field.key} className="profile-field empty-field">
                    {field.section === 'name' && renderNameInputFloating()}
                    {field.section === 'phone' && renderPhoneInputFloating()}
                    {field.section === 'interests' && (
                      <div className="profile-section-field">
                        <div className="profile-section-label">Interests</div>
                        <InterestSelector options={availableInterests} selected={interests} onChange={setInterests} hideLabel />
                        <p className="profile-input-hint">Select all that apply</p>
                      </div>
                    )}
                    {field.section === 'gender' && (
                      <div className="profile-section-field">
                        <div className="profile-section-label">Gender</div>
                        <GenderSelector value={gender} onChange={setGender} hideLabel />
                      </div>
                    )}
                    {field.section === 'dob' && (
                      <div className="profile-section-field">
                        <div className="profile-section-label">{dobVariant === 'date_picker' ? 'Date of Birth' : 'Age Range'}</div>
                        <DOBInput variant={dobVariant} dateValue={dateOfBirth} onDateChange={setDateOfBirth} ageRangeValue={ageRange} onAgeRangeChange={setAgeRange} hideLabel />
                        {dobVariant === 'date_picker' && <p className="profile-input-hint">Must be 18 or older</p>}
                      </div>
                    )}
                    {field.section === 'marketing' && (
                      <div className="profile-section-field">
                        <div className="profile-section-label">Stay in touch</div>
                        <p className="profile-input-hint" style={{ marginBottom: '12px' }}>Choose how you'd like to hear from us</p>
                        <MarketingPreferences channels={availableChannels} selected={marketingPrefs} onChange={setMarketingPrefs} hideLabel />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Save Bar */}
      <div className={`save-bar ${unsavedChanges ? 'visible' : ''}`}>
        <div className="save-bar-content">
          <div className="save-bar-message">
            <div className="unsaved-indicator"></div>
            <span>You have unsaved changes</span>
          </div>
          <div className="save-bar-actions">
            <button
              className="discard-btn"
              onClick={handleDiscard}
              disabled={submitting}
            >
              Discard
            </button>
            <button
              className="save-btn"
              onClick={handleSave}
              disabled={submitting}
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Actions - Always visible */}
      <div className="profile-actions">
        <button
          className="return-btn"
          onClick={handleSaveAndReturn}
          disabled={submitting}
        >
          {submitting ? 'Saving...' : unsavedChanges ? 'Save & Return to Dashboard' : 'Return to Dashboard'}
        </button>
      </div>
    </div>
  );
};

export default ProfileCompletion;
