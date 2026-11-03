import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { Embed } from './app/Embed';
import './app/app.css';

const embed = new URLSearchParams(location.search).has('embed');
if (embed) document.documentElement.classList.add('is-embed');

createRoot(document.getElementById('root')!).render(<StrictMode>{embed ? <Embed /> : <App />}</StrictMode>);
