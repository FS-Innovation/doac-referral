import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import InterestSelector from './profile/InterestSelector';
import GenderSelector from './profile/GenderSelector';
import DOBInput from './profile/DOBInput';
import MarketingPreferences from './profile/MarketingPreferences';
import { profileAPI, experimentAPI } from '../services/api';
import {
  trackOnboardingViewed,
  trackOnboardingCompleted,
  trackOnboardingSkipped,
  trackExperimentViewed,
} from '../services/analytics';
import './OnboardingModal.css';

const OnboardingModal = ({ onComplete }) => {
  const { user, refreshUser } = useAuth();

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [interests, setInterests] = useState([]);
  const [gender, setGender] = useState('');
  const [dobVariant, setDobVariant] = useState(null);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [marketingPrefs, setMarketingPrefs] = useState([]);

  // Check if name was already provided during registration
  const hasNameFromRegistration = !!(user?.firstName || user?.name);

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

  // Scroll tracking - buttons enabled after scrolling to bottom
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    trackOnboardingViewed();
    loadOptions();
  }, []);

  const loadOptions = async () => {
    try {
      const [interestsRes, channelsRes, variantRes] = await Promise.all([
        profileAPI.getInterests(),
        profileAPI.getMarketingChannels(),
        experimentAPI.getVariant('dob_input_type'),
      ]);

      setAvailableInterests(interestsRes.data.interests);
      setAvailableChannels(channelsRes.data.channels);
      setDobVariant(variantRes.data.variant);

      if (variantRes.data.variant) {
        trackExperimentViewed('dob_input_type', variantRes.data.variant);
      }
    } catch (err) {
      console.error('Error loading options:', err);
      setError('Failed to load options. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Check if user has scrolled to the bottom (or near bottom)
  const checkScrollPosition = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    // Consider "at bottom" if within 20px of the bottom
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 20;

    if (isAtBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  }, [hasScrolledToBottom]);

  // Check scroll position after content loads
  useEffect(() => {
    if (!loading) {
      // Small delay to ensure DOM is rendered, then check initial scroll position
      setTimeout(() => {
        checkScrollPosition();
      }, 100);
    }
  }, [loading, checkScrollPosition]);

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

      const completedFields = [];
      if (name) completedFields.push('firstName');
      if (phone) completedFields.push('phone');
      if (interests.length > 0) completedFields.push('interests');
      if (gender) completedFields.push('gender');
      if (dateOfBirth || ageRange) completedFields.push('dob');
      if (marketingPrefs.length > 0) completedFields.push('marketingPreferences');

      trackOnboardingCompleted(completedFields);
      onComplete();
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
      onComplete();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to skip. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="onboarding-modal-overlay">
        <div className="onboarding-modal">
          <div className="onboarding-modal-loading">
            <div className="spinner"></div>
            <p>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="onboarding-modal-overlay">
      <div className="onboarding-modal">
        {/* Header */}
        <div className="onboarding-modal-header">
          <h2>Welcome to DOAC Perks</h2>
          <p className="onboarding-modal-subtitle">
            Help us personalise your experience
          </p>
        </div>

        {error && (
          <div className="onboarding-modal-error">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            {error}
          </div>
        )}

        {/* Scrollable Form */}
        <div
          className="onboarding-modal-body"
          ref={scrollContainerRef}
          onScroll={checkScrollPosition}
        >
          {/* Name - only show if not provided during registration */}
          {!hasNameFromRegistration && (
            <div className="onboarding-modal-field">
              <div className={`onboarding-floating-label ${nameFocused || name ? 'focused' : ''}`}>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                  className="onboarding-input"
                  autoComplete="name"
                  disabled={submitting}
                />
                <label className="onboarding-label-text">Name (optional)</label>
              </div>
            </div>
          )}

          {/* Phone */}
          <div className="onboarding-modal-field">
            <div className={`onboarding-floating-label ${phoneFocused || phone ? 'focused' : ''}`}>
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
              <label className="onboarding-label-text">Phone (optional)</label>
            </div>
            <p className="onboarding-hint">Include country code (e.g. +44)</p>
          </div>

          {/* Interests */}
          <div className="onboarding-modal-field">
            <div className="onboarding-section">
              <label className="onboarding-section-label">Interests (optional)</label>
              <p className="onboarding-hint" style={{ marginTop: 0, marginBottom: '10px' }}>
                Select topics you enjoy
              </p>
              <InterestSelector
                options={availableInterests}
                selected={interests}
                onChange={setInterests}
                hideLabel
              />
            </div>
          </div>

          {/* Gender */}
          <div className="onboarding-modal-field">
            <div className="onboarding-section">
              <label className="onboarding-section-label">Gender (optional)</label>
              <GenderSelector
                value={gender}
                onChange={setGender}
                hideLabel
              />
            </div>
          </div>

          {/* Date of Birth / Age Range */}
          <div className="onboarding-modal-field">
            <div className="onboarding-section">
              <label className="onboarding-section-label">
                {dobVariant === 'date_picker' ? 'Date of Birth (optional)' : 'Age Range (optional)'}
              </label>
              <p className="onboarding-hint" style={{ marginTop: 0, marginBottom: '10px' }}>
                {dobVariant === 'date_picker' ? 'Must be 18 or older to participate' : 'Helps us tailor content for you'}
              </p>
              <DOBInput
                variant={dobVariant}
                dateValue={dateOfBirth}
                onDateChange={setDateOfBirth}
                ageRangeValue={ageRange}
                onAgeRangeChange={setAgeRange}
                hideLabel
              />
            </div>
          </div>

          {/* Marketing Preferences */}
          <div className="onboarding-modal-field">
            <div className="onboarding-section">
              <label className="onboarding-section-label">Communication</label>
              <p className="onboarding-hint" style={{ marginTop: 0, marginBottom: '10px' }}>
                How would you like to hear about new prizes and updates?
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

        {/* Footer Actions */}
        <div className={`onboarding-modal-footer ${!hasScrolledToBottom ? 'disabled' : ''}`}>
          {!hasScrolledToBottom && (
            <p className="onboarding-scroll-hint">Scroll down to continue</p>
          )}
          <button
            className="onboarding-continue-btn"
            onClick={handleContinue}
            disabled={submitting || !hasScrolledToBottom}
          >
            {submitting ? 'Saving...' : 'Continue'}
          </button>
          <button
            className={`onboarding-skip-btn ${!hasScrolledToBottom ? 'hidden' : ''}`}
            onClick={handleSkip}
            disabled={submitting || !hasScrolledToBottom}
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingModal;
