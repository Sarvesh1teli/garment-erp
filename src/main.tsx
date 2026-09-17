import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { DesktopGate } from './DesktopGate';
import './styles.css';

// Register PWA Service Worker for offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><DesktopGate><App /></DesktopGate></React.StrictMode>);

