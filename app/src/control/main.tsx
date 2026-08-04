import React from "react";
import { createRoot } from "react-dom/client";
import ControlApp from "./ControlApp";
import "../styles/control.css";

const root = createRoot(document.getElementById("root") as HTMLElement);
root.render(
  <React.StrictMode>
    <ControlApp />
  </React.StrictMode>
);
