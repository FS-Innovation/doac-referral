const MarketingPreferences = ({ channels, selected, onChange }) => {
  const toggleChannel = (slug) => {
    if (selected.includes(slug)) {
      onChange(selected.filter(s => s !== slug));
    } else {
      onChange([...selected, slug]);
    }
  };

  return (
    <div className="form-section">
      <label className="form-section-label">Stay in touch</label>
      <p className="form-section-hint" style={{ marginBottom: '12px' }}>
        Choose how you'd like to hear from us
      </p>
      <div className="marketing-channels">
        {channels.map((channel) => (
          <label key={channel.slug} className="marketing-channel">
            <input
              type="checkbox"
              checked={selected.includes(channel.slug)}
              onChange={() => toggleChannel(channel.slug)}
            />
            <div className="marketing-channel-info">
              <span className="marketing-channel-name">{channel.display_name}</span>
              {channel.description && (
                <span className="marketing-channel-desc">{channel.description}</span>
              )}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
};

export default MarketingPreferences;
