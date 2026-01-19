const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' }
];

const GenderSelector = ({ value, onChange, hideLabel = false }) => {
  return (
    <div className={hideLabel ? "gender-selector-container" : "form-section"}>
      {!hideLabel && <label className="form-section-label">Gender</label>}
      <div className="gender-options">
        {GENDER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`gender-option ${value === option.value ? 'selected' : ''}`}
            onClick={() => onChange(value === option.value ? '' : option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default GenderSelector;
