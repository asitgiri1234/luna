import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Importing the appearance service applies the saved theme / accent /
// font size / density to the document before the first paint.
import "./appearance/appearance.service";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
