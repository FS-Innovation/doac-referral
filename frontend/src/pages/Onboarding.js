import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import InterestSelector from '../components/profile/InterestSelector';
import GenderSelector from '../components/profile/GenderSelector';
import DOBInput from '../components/profile/DOBInput';
import MarketingPreferences from '../components/profile/MarketingPreferences';
import { profileAPI, experimentAPI } from '../services/api';
import {
  trackOnboardingViewed,
  trackOnboardingCompleted,
  trackOnboardingSkipped,
  trackExperimentViewed,
} from '../services/analytics';
import './Onboarding.css';

const Onboarding = () => {
  const { user, emailVerified, refreshUser } = useAuth();
  const navigate = useNavigate();

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [interests, setInterests] = useState([]);
  const [gender, setGender] = useState('');
  const [dobVariant, setDobVariant] = useState(null);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [marketingPrefs, setMarketingPrefs] = useState([]);

  // Focus states for floating labels
  const [nameFocused, setNameFocused] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);

  // Available options (loaded from API)
  const [availableInterests, setAvailableInterests] = useState([]);
  const [availableChannels, setAvailableChannels] = useState([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user && !emailVerified) {
      navigate('/confirm-email');
      return;
    }
    trackOnboardingViewed();
    loadOptions();
  }, [user, emailVerified, navigate]);

  const loadOptions = async () => {
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

      // Pre-populate with any existing data
      const profile = profileRes.data.profile;
      if (profile) {
        setName(profile.firstName || user?.name || '');
        setPhone(profile.phone || '');
        setInterests(profile.interests || []);
        setGender(profile.gender || '');
        setDateOfBirth(profile.dateOfBirth || '');
        setAgeRange(profile.ageRange || '');
        setMarketingPrefs(profile.marketingPreferences || []);
        if (profile.dobVariant) setDobVariant(profile.dobVariant);
      }
    } catch (err) {
      console.error('Error loading options:', err);
      setError('Failed to load options. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
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

      await profileAPI.completeProfile(profileData);
      await refreshUser();

      // Track which fields were completed
      const completedFields = [];
      if (name) completedFields.push('name');
      if (phone) completedFields.push('phone');
      if (interests.length > 0) completedFields.push('interests');
      if (gender) completedFields.push('gender');
      if (dateOfBirth || ageRange) completedFields.push('dob');
      if (marketingPrefs.length > 0) completedFields.push('marketingPreferences');

      trackOnboardingCompleted(completedFields);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save. Please try again.');
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    setSubmitting(true);
    setError('');

    try {
      await profileAPI.skipProfile();
      trackOnboardingSkipped();
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to skip. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="onboarding-page">
        <div className="onboarding-loading">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-container">
        {/* Header */}
        <div className="onboarding-header">
          <h1>Tell us about yourself</h1>
          <p className="subtitle">All fields are optional - share what you'd like</p>
        </div>

        {error && (
          <div className="onboarding-error">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            {error}
          </div>
        )}

        {/* Form */}
        <div className="onboarding-form">
          {/* Name */}
          <div className="onboarding-field">
            <div className={`onboarding-floating-label ${nameFocused || name ? 'focused' : ''}`}>
              <div className="onboarding-input-wrapper">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                  className="onboarding-input"
                  disabled={submitting}
                />
                <label className="onboarding-floating-label-text">Name</label>
              </div>
            </div>
          </div>

          {/* Phone */}
          <div className="onboarding-field">
            <div className={`onboarding-floating-label ${phoneFocused || phone ? 'focused' : ''}`}>
              <div className="onboarding-input-wrapper">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onFocus={() => setPhoneFocused(true)}
                  onBlur={() => setPhoneFocused(false)}
                  className="onboarding-input"
                  autoComplete="tel"
                  disabled={submitting}
                />
                <label className="onboarding-floating-label-text">Phone Number</label>
              </div>
              <p className="onboarding-input-hint">Include country code (e.g., +44 for UK)</p>
            </div>
          </div>

          {/* Interests */}
          <div className="onboarding-field">
            <div className="onboarding-section-field">
              <div className="onboarding-section-label">Interests</div>
              <InterestSelector
                options={availableInterests}
                selected={interests}
                onChange={setInterests}
                hideLabel
              />
              <p className="onboarding-input-hint">Select all that apply</p>
            </div>
          </div>

          {/* Gender */}
          <div className="onboarding-field">
            <div className="onboarding-section-field">
              <div className="onboarding-section-label">Gender</div>
              <GenderSelector
                value={gender}
                onChange={setGender}
                hideLabel
              />
            </div>
          </div>

          {/* Date of Birth / Age Range */}
          <div className="onboarding-field">
            <div className="onboarding-section-field">
              <div className="onboarding-section-label">
                {dobVariant === 'date_picker' ? 'Date of Birth' : 'Age Range'}
              </div>
              <DOBInput
                variant={dobVariant}
                dateValue={dateOfBirth}
                onDateChange={setDateOfBirth}
                ageRangeValue={ageRange}
                onAgeRangeChange={setAgeRange}
                hideLabel
              />
              {dobVariant === 'date_picker' && (
                <p className="onboarding-input-hint">Must be 18 or older</p>
              )}
            </div>
          </div>

          {/* Marketing Preferences */}
          <div className="onboarding-field">
            <div className="onboarding-section-field">
              <div className="onboarding-section-label">Stay in touch</div>
              <p className="onboarding-input-hint" style={{ marginBottom: '12px', marginTop: 0 }}>
                Choose how you'd like to hear from us
              </p>
              <MarketingPreferences
                channels={availableChannels}
                selected={marketingPrefs}
                onChange={setMarketingPrefs}
                hideLabel
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="onboarding-actions">
          <button
            className="onboarding-continue-btn"
            onClick={handleContinue}
            disabled={submitting}
          >
            {submitting ? 'Saving...' : 'Continue'}
          </button>

          <button
            className="onboarding-skip-link"
            onClick={handleSkip}
            disabled={submitting}
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
