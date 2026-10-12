'use client';
export type AudioChoice = { mode: 'link' | 'none'; url: string };
export default function AudioEditor({
  value,
  onChange,
}: {
  value?: AudioChoice;
  onChange: (value: AudioChoice) => void;
}) {
  const mode = value?.mode || 'link';
  return (
    <div className="audio-fields">
      <label>
        Audio option
        <select
          value={mode}
          onChange={(e) =>
            onChange({
              mode: e.target.value as 'link' | 'none',
              url: e.target.value === 'none' ? '' : value?.url || '',
            })
          }
        >
          <option value="link">Audio link / instructions</option>
          <option value="none">None</option>
        </select>
      </label>
      {mode === 'link' ? (
        <label>
          Audio link <span className="optional">Optional</span>
          <input
            type="url"
            inputMode="url"
            value={value?.url || ''}
            maxLength={2048}
            placeholder="https://… paste a sound or music link"
            onChange={(e) => onChange({ mode: 'link', url: e.target.value })}
          />
        </label>
      ) : (
        <p className="audio-none-help">This script will show “None” for audio.</p>
      )}
    </div>
  );
}
