import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Newsreader bundled (offline-first, README §11): variable + italic (okuyucu için).
import "@fontsource-variable/newsreader";
import "@fontsource-variable/newsreader/opsz-italic.css";

import "./styles/themes.css";
import "./styles/global.css";
import "./styles/components.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
