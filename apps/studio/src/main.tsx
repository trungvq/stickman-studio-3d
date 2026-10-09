import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { loadRepoParts, RepoPartsError } from "./repoParts";

void loadRepoParts().then((error) =>
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      {error && <RepoPartsError message={error} />}
      <App />
    </StrictMode>,
  ),
);
