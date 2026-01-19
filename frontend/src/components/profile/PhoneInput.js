const PhoneInput = ({ value, onChange, hideLabel = false }) => {
  return (
    <div className={hideLabel ? "phone-input-container" : "form-section"}>
      {!hideLabel && <label className="form-section-label">Phone Number</label>}
      <div className="phone-input-wrapper">
        <input
          type="tel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. +44 7700 900000"
          autoComplete="tel"
        />
      </div>
      {!hideLabel && <p className="form-section-hint">Include country code (e.g., +44 for UK)</p>}
    </div>
  );
};

export default PhoneInput;
