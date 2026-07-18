import React from "react";
import { createRoot } from "react-dom/client";
import CityLogger from "../../src/frontend/CityLogger";
import "../../src/frontend/styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("CityLogger could not find its mobile root element.");
}

createRoot(root).render(
  <React.StrictMode>
    <CityLogger />
  </React.StrictMode>
);
