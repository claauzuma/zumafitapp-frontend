import React from "react";
import { Outlet } from "react-router-dom";
import AdminNavBar from "./AdminNavBar.jsx";
import "./adminLayout.css";

export default function AdminLayout() {
  return (
    <div className="admin-shell">
      <AdminNavBar />
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}


