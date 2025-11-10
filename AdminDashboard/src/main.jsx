import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { I18nProvider } from "./i18n";
import { MartProvider } from "./context/MartContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <I18nProvider>
      <MartProvider>
        <App />
      </MartProvider>
    </I18nProvider>
  </StrictMode>
);
