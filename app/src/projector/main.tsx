import React from "react";
import { createRoot } from "react-dom/client";
import ProjectorApp from "./ProjectorApp";
import "../styles/projector.css";

const root = createRoot(document.getElementById("root") as HTMLElement);
root.render(
  <React.StrictMode>
    <ProjectorApp />
  </React.StrictMode>
);
