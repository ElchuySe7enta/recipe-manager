import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import Root from "./Root.jsx";
import InvitePage from "./InvitePage.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/invite/:token" element={<InvitePage />} />
        <Route path="*" element={<Root />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
