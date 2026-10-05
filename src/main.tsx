import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { DesktopGate } from './DesktopGate';
import { SchoolUniformOrderApp } from './SchoolUniformOrderApp';
import './styles.css';

// Register PWA Service Worker for offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

const schoolPortal=window.location.pathname.replace(/\/$/,'')==='/school-orders'||new URLSearchParams(window.location.search).get('app')==='school';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{schoolPortal?<SchoolUniformOrderApp/>:<DesktopGate><App /></DesktopGate>}</React.StrictMode>);

