import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Simple Service Worker Registration for PWA capabilities
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // In a real environment, you would point to /sw.js
    // navigator.serviceWorker.register('/sw.js').then(registration => {
    //   console.log('SW registered: ', registration);
    // }).catch(registrationError => {
    //   console.log('SW registration failed: ', registrationError);
    // });
    console.log('Service Worker supported (PWA ready logic)');
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);