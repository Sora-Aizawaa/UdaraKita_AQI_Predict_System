import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { IdiomaProvider } from "./idioma.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <IdiomaProvider>
    <App />
  </IdiomaProvider>,
);
