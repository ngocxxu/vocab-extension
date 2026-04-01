import React from 'react';
import ReactDOM from 'react-dom/client';
import Options from './Options';
import '../styles/globals.css';
import { ThemeProvider } from '../components/providers/ThemeProvider';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <Options />
    </ThemeProvider>
  </React.StrictMode>,
);

