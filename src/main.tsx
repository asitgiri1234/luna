import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Importing the appearance service applies the saved theme / accent /
// font size / density to the document before the first paint.
import "./appearance/appearance.service";
// Importing the AI settings service applies the saved model / sampling /
// streaming / auto-save onto the live AI config before the first request.
import "./ai/settings/ai-settings.service";
// Importing the personalization service loads the saved assistant persona
// so the prompt builder and UI use it from the first render / request.
import "./personalization/personalization.service";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
