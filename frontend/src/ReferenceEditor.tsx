'use client';
import { Plus, Trash2 } from 'lucide-react';
import type { ReferenceVideo } from './ReferenceVideos';
export default function ReferenceEditor({
  value,
  onChange,
}: {
  value: ReferenceVideo[];
  onChange: (value: ReferenceVideo[]) => void;
}) {
  function update(i: number, key: 'label' | 'url', text: string) {
    onChange(value.map((ref, j) => (i === j ? { ...ref, [key]: text } : ref)));
  }
  return (
    <section className="reference-editor">
      <div className="field">
        Video Inspiration <span className="optional">Optional</span>
        <span className="field-help">
          Add inspiration or example videos. These links appear near the top of the script.
        </span>
      </div>
      {value.map((ref, i) => (
        <div className="reference-row" key={i}>
          <div className="reference-fields">
            <label>
              Video name
              <input
                aria-label={`Reference video ${i + 1} name`}
                value={ref.label}
                maxLength={100}
                onChange={(e) => update(i, 'label', e.target.value)}
                placeholder={`Video Inspiration ${i + 1}`}
              />
            </label>
            <label>
              Video link
              <input
                aria-label={`Reference video ${i + 1} link`}
                type="url"
                inputMode="url"
                value={ref.url}
                maxLength={2048}
                onChange={(e) => update(i, 'url', e.target.value)}
                placeholder="https://www.tiktok.com/…"
              />
            </label>
          </div>
          <button
            type="button"
            className="icon-button"
            title="Remove reference"
            aria-label={`Remove reference video ${i + 1}`}
            onClick={() => onChange(value.filter((_, j) => i !== j))}
          >
            <Trash2 size={17} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="secondary"
        disabled={value.length >= 10}
        onClick={() => onChange([...value, { label: '', url: '' }])}
      >
        <Plus size={17} />
        Add reference video
      </button>
    </section>
  );
}
