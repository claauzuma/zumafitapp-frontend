import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { queryClient } from "./queryClient.js";
import {
  installLiveTabContinuity,
  restoreLiveTabScroll,
  restoreLiveTabSnapshot,
} from "./appSessionContinuity.js";
import "./index.css";
import "./styles/design-system.css";

const liveTabResume = restoreLiveTabSnapshot(queryClient);
installLiveTabContinuity(queryClient);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);

if (liveTabResume.restored) restoreLiveTabScroll(liveTabResume.scroll);
