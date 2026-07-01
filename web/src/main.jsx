import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx?open-design";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
