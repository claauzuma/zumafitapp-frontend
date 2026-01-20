// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";

import Bienvenida from "./bienvenida.jsx";
import AuthPage from "./AuthPage.jsx";

import ProtectedRoute from "./ProtectedRoute.jsx";
import PublicOnlyRoute from "./PublicOnlyRoute.jsx";
import RequireRole from "./RequireRole.jsx";

import AppLayout from "./AppLayout.jsx";
import AdminLayout from "./AdminLayout.jsx";

import InicioEntrenado from "./entrenado/InicioEntrenado.jsx";
import MenuEj from "./entrenado/MenuEj.jsx";

import Perfil from "./entrenado/Perfil.jsx";
import Rutinas from "./entrenado/Rutinas.jsx";
import Progresos from "./entrenado/Progresos.jsx";
import Ajustes from "./entrenado/Ajustes.jsx";

import AdminInicio from "./AdminInicio.jsx";
import AdminUsuarios from "./AdminUsuarios.jsx";
import AdminComidas from "./AdminComidas.jsx";
import AdminAlimentos from "./AdminAlimentos.jsx";
import AdminRutinas from "./AdminRutinas.jsx";

export default function App() {
  return (
    <Routes>
      {/* ✅ PUBLIC */}
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

      {/* alias por si algún link va a /auth */}
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
        <Route path="usuarios" element={<AdminUsuarios />} />
        <Route path="comidas" element={<AdminComidas />} />
        <Route path="alimentos" element={<AdminAlimentos />} />
        <Route path="rutinas" element={<AdminRutinas />} />
      </Route>

      {/* ✅ APP (CLIENTE) */}
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

      {/* fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
