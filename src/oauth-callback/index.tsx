import React from "react";
import ReactDOM from "react-dom/client";
import "../styles/globals.css";
import { ThemeProvider } from "../components/providers/ThemeProvider";
import OAuthCallback from "./OAuthCallback.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <OAuthCallback />
    </ThemeProvider>
  </React.StrictMode>
);

