import RichContent from './RichContent';
import { plainText, safeLink } from './rich-text.js';
import type { AudioChoice } from './AudioEditor';
import { Music, ExternalLink } from 'lucide-react';
export default function ScriptText({
  text,
  section,
  audio,
}: {
  text: string;
  section?: string;
  audio?: AudioChoice;
}) {
  const none = section === 'Audio' && audio?.mode === 'none';
  const url =
    section === 'Audio' && audio?.mode === 'link' && audio.url ? safeLink(audio.url) : null;
  const audioUrl = url && /^https?:\/\//.test(url) ? url : null;
  if (!none && !audioUrl && !plainText(text).trim()) return null;
  return (
    <section className="script-section">
      {section && <h2>{section}</h2>}
      {none ? (
        <p className="audio-none">None</p>
      ) : (
        <>
          {audioUrl && (
            <a
              className="audio-reference"
              href={audioUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Music size={18} />
              <span>
                <strong>Open audio reference</strong>
                <span>{audioUrl}</span>
              </span>
              <ExternalLink size={16} />
            </a>
          )}
          {plainText(text).trim() && <RichContent value={text} />}
        </>
      )}
    </section>
  );
}
