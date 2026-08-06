import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { DesktopGate } from './DesktopGate';
import './styles.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><DesktopGate><App /></DesktopGate></React.StrictMode>);
