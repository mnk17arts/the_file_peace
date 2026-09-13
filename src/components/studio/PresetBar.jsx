/**
 * Preset Selection Bar
 *
 * Standardized option cards / chips for tool presets (e.g. compression levels, rotation angles, output qualities).
 */
export default function PresetBar({
  label,
  presets = [],
  selectedId,
  onSelect,
  compact = false,
}) {
  if (!presets || presets.length === 0) return null;

  return (
    <div className="preset-bar-container" style={{ marginBottom: '1.25rem' }}>
      {label && (
        <label className="preset-bar-label">
          {label}
        </label>
      )}

      {compact ? (
        // Compact Pill Mode (e.g. for small panels or toolbar strips)
        <div className="preset-pills-row">
          {presets.map((preset) => {
            const isSelected = selectedId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                className={`preset-pill-btn ${isSelected ? 'active' : ''}`}
                onClick={() => onSelect(preset.id)}
              >
                {preset.icon && <preset.icon size={13} style={{ marginRight: 4 }} />}
                <span>{preset.title || preset.label}</span>
                {preset.badge && (
                  <span className="preset-pill-badge">{preset.badge}</span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        // Card Mode (Standard studio control panel cards)
        <div className="preset-cards-grid">
          {presets.map((preset) => {
            const isSelected = selectedId === preset.id;
            return (
              <div
                key={preset.id}
                className={`preset-card ${isSelected ? 'active' : ''}`}
                onClick={() => onSelect(preset.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(preset.id);
                  }
                }}
              >
                <div className="preset-card-header">
                  <span className="preset-card-title">{preset.title || preset.label}</span>
                  {preset.badge && (
                    <span className={`preset-card-badge ${isSelected ? 'selected' : ''}`}>
                      {preset.badge}
                    </span>
                  )}
                </div>

                {preset.desc && (
                  <p className="preset-card-desc">
                    {preset.desc}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
