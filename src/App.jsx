// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";

import Bienvenida from "./bienvenida.jsx";
import AuthPage from "./AuthPage.jsx";

import ProtectedRoute from "./ProtectedRoute.jsx";
import PublicOnlyRoute from "./PublicOnlyRoute.jsx";
import RequireRole from "./RequireRole.jsx";

import AppLayout from "./AppLayout.jsx";
import AdminLayout from "./AdminLayout.jsx""

import InicioEntrenado from "./entrenado/InicioEntrenado.jsx";
import MenuEj from "./entrenado/MenuEj.jsx";

import Perfil from "./entrenado/Perfil.jsx";
import Rutinas from "./entrenado/Rutinas.jsx";
import Progresos from "./entrenado/Progresos.jsx";
import Ajustes from "./entrenado/Ajustes.jsx";

import AdminInicio from "./admin/AdminInicio.jsx";

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <PublicOnlyRoute>
            <Bienvenida />
          </PublicOnlyRoute>
        }
      />

      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <AuthPage defaultMode="login" />
          </PublicOnlyRoute>
        }
      />
      <Route
  path="/auth"
  element={
    <PublicOnlyRoute>
      <AuthPage defaultMode="login" />
    </PublicOnlyRoute>
  }
/>

      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <AuthPage defaultMode="register" />
          </PublicOnlyRoute>
        }
      />

      {/* ✅ ADMIN */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <RequireRole role="admin">
              <AdminLayout />
            </RequireRole>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="inicio" replace />} />
        <Route path="inicio" element={<AdminInicio />} />
      </Route>

      {/* ✅ APP */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="inicio" replace />} />
        <Route path="inicio" element={<InicioEntrenado />} />
        <Route path="menu" element={<MenuEj />} />
        <Route path="perfil" element={<Perfil />} />
        <Route path="rutinas" element={<Rutinas />} />
        <Route path="progresos" element={<Progresos />} />
        <Route path="ajustes" element={<Ajustes />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
