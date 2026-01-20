import React from "react";
import { Outlet } from "react-router-dom";
import AdminNavBar from "./AdminNavBar.jsx";

export default function AdminLayout() {
  return (
    <div style={{ minHeight: "100vh", background: "#0b0b0b" }}>
      <AdminNavBar />
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: 16 }}>
        <Outlet />
      </div>
    </div>
  );
}


