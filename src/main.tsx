import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "./App";
import { initTheme } from "./hooks/useTheme";
import "@fontsource-variable/jetbrains-mono/wght.css";
import "@fontsource-variable/roboto-flex/wght.css";
import "./index.css";

initTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
