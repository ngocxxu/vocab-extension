import React from 'react';
import ReactDOM from 'react-dom/client';
import Popup from './Popup';
import '../styles/globals.css';
import { ThemeProvider } from '../components/providers/ThemeProvider';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <Popup />
    </ThemeProvider>
  </React.StrictMode>,
);

