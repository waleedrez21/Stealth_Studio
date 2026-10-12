import { useEffect, useRef, useState } from 'react';
import { API, authHeaders } from './api';
export function useRealtime(scope: 'published' | 'draft', enabled = true) {
  const [version, setVersion] = useState(0);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const callback = useRef(() => setVersion((v) => v + 1));
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout>;
    async function connect() {
      controller = new AbortController();
      try {
        const response = await fetch(`${API}/api/events?scope=${scope}`, {
          headers: await authHeaders(),
          signal: controller.signal,
        });
        if (!response.ok || !response.body) throw new Error('Live updates unavailable.');
        setConnected(true);
        setError('');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!stopped) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let index;
          while ((index = buffer.indexOf('\n\n')) >= 0) {
            const frame = buffer.slice(0, index);
            buffer = buffer.slice(index + 2);
            const data = frame.split('\n').find((line) => line.startsWith('data: '));
            if (data) {
              const event = JSON.parse(data.slice(6));
              if (event.type === 'change') callback.current();
              else if (event.type === 'unavailable') throw new Error('Live updates unavailable.');
            }
          }
        }
      } catch (e) {
        if (!stopped) setError('Live updates are reconnecting. Your saved data is safe.');
      } finally {
        setConnected(false);
        if (!stopped) timer = setTimeout(connect, 5000);
      }
    }
    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [scope, enabled]);
  return { version, connected, error };
}
