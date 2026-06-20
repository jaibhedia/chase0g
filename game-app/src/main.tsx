import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// No React.StrictMode — Strict Mode's double-mount causes Phaser's WebGL
// context to throw "Framebuffer Incomplete Attachment" when the first mount
// is torn down and the second fires against the already-destroyed GL context.
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
