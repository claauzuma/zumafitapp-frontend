// src/AppLayout.jsx
import React from "react";
import { Outlet } from "react-router-dom";
import ClientNavBar from "./ClienteNavBar.jsx";

export default function AppLayout() {
  return (
    <div style={{ minHeight: "100dvh", background: "#0b0b0b" }}>
      <ClientNavBar />
      <Outlet />
    </div>
  );
}
