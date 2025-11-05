import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { MartProvider } from "./context/MartContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <MartProvider>
      <App />
    </MartProvider>
  </StrictMode>
);
