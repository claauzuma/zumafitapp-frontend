import React from "react";
import { Outlet } from "react-router-dom";
import AdminNavBar from "./AdminNavBar.jsx";

export default function AdminLayout() {
  return (
    <div>
      <AdminNavBar />
      <div style={{ padding: 12 }}>
        <Outlet />
      </div>
    </div>
  );
}
