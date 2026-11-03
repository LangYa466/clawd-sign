import { useEffect, useState } from 'react';
import { ClawdSign, DEFAULT_OPTIONS, type ThemeMode } from '../clawd-sign';
import { decodeHash } from './state';

function read() {
  const shared = decodeHash(location.hash);
  const param = new URLSearchParams(location.search).get('theme');
  const theme = (shared?.theme ?? (['light', 'dark', 'system'].includes(param ?? '') ? param : 'system')) as ThemeMode;
  return { options: shared?.options ?? DEFAULT_OPTIONS, theme };
}

/** `?embed=1#<state>` — just the sign, scaled to fill the frame. For iframes and OBS browser sources. */
export function Embed() {
  const [state, setState] = useState(read);
  useEffect(() => {
    const onHash = () => setState(read());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return (
    <div className="embed">
      <ClawdSign {...state.options} theme={state.theme} style={{ width: '100%', height: '100%', maxWidth: 'none' }} />
    </div>
  );
}
