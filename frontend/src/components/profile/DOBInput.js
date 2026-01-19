const AGE_RANGES = [
  { value: '', label: 'Select age range' },
  { value: '18-24', label: '18-24' },
  { value: '25-34', label: '25-34' },
  { value: '35-44', label: '35-44' },
  { value: '45-54', label: '45-54' },
  { value: '55+', label: '55+' }
];

// Calculate max date (must be 18 years old)
const getMaxDate = () => {
  const today = new Date();
  today.setFullYear(today.getFullYear() - 18);
  return today.toISOString().split('T')[0];
};

const DOBInput = ({ variant, dateValue, onDateChange, ageRangeValue, onAgeRangeChange, hideLabel = false }) => {
  // A/B Test: Show either date picker or age range dropdown
  if (variant === 'date_picker') {
    return (
      <div className={hideLabel ? "dob-input-container" : "form-section"}>
        {!hideLabel && <label className="form-section-label">Date of Birth</label>}
        <div className="dob-input-wrapper">
          <input
            type="date"
            value={dateValue}
            onChange={(e) => onDateChange(e.target.value)}
            max={getMaxDate()}
            placeholder="MM/DD/YYYY"
          />
        </div>
        {!hideLabel && <p className="form-section-hint">Must be 18 or older</p>}
      </div>
    );
  }

  // Default: age_range variant
  return (
    <div className={hideLabel ? "dob-input-container" : "form-section"}>
      {!hideLabel && <label className="form-section-label">Age Range</label>}
      <div className="dob-input-wrapper">
        <select
          value={ageRangeValue}
          onChange={(e) => onAgeRangeChange(e.target.value)}
        >
          {AGE_RANGES.map((range) => (
            <option key={range.value} value={range.value}>
              {range.label}
            </option>
          ))}
        </select>
        <div className="dob-select-arrow">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 4.5L6 7.5L9 4.5"/>
          </svg>
        </div>
      </div>
    </div>
  );
};

export default DOBInput;
