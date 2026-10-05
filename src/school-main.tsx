import React from 'react';
import ReactDOM from 'react-dom/client';
import { SchoolUniformOrderApp } from './SchoolUniformOrderApp';
import './styles.css';
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/school-orders/sw.js',{scope:'/school-orders/'}).catch(()=>{}));
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><SchoolUniformOrderApp/></React.StrictMode>);
