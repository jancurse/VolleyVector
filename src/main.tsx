import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { AuthProvider } from "./auth/useAuth";
import { ErrorBoundary } from "./shell/ErrorBoundary";
import "./index.css";

const root = document.getElementById("root");

if (!root) throw new Error("Root element #root not found");

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>
);
