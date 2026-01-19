const InterestSelector = ({ options, selected, onChange }) => {
  const toggleInterest = (slug) => {
    if (selected.includes(slug)) {
      onChange(selected.filter(s => s !== slug));
    } else {
      onChange([...selected, slug]);
    }
  };

  return (
    <div className="form-section">
      <label className="form-section-label">What topics interest you?</label>
      <div className="interest-chips">
        {options.map((interest) => (
          <button
            key={interest.slug}
            type="button"
            className={`interest-chip ${selected.includes(interest.slug) ? 'selected' : ''}`}
            onClick={() => toggleInterest(interest.slug)}
          >
            <span className="check-icon">
              {selected.includes(interest.slug) && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </span>
            {interest.display_name}
          </button>
        ))}
      </div>
      <p className="form-section-hint">Select all that apply</p>
    </div>
  );
};

export default InterestSelector;
