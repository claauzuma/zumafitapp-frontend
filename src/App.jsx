// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";

import Bienvenida from "./bienvenida.jsx";
import AuthPage from "./AuthPage.jsx";

import ProtectedRoute from "./ProtectedRoute.jsx";
import PublicOnlyRoute from "./PublicOnlyRoute.jsx";

import AppLayout from "./AppLayout.jsx";

// Pantallas del panel:
import InicioEntrenado from "./entrenado/InicioEntrenado.jsx";
import MenuEj from "./entrenado/MenuEj.jsx";

// (Opcional) otras:
import Perfil from "./entrenado/Perfil.jsx";
import Rutinas from "./entrenado/Rutinas.jsx";
import Progresos from "./entrenado/Progresos.jsx";
import Ajustes from "./entrenado/Ajustes.jsx";

export default function App() {
  return (
    <Routes>
      {/* ✅ Landing SOLO público: si está logueado -> /app/inicio */}
      <Route
        path="/"
        element={
          <PublicOnlyRoute>
            <Bienvenida />
          </PublicOnlyRoute>
        }
      />

      {/* ✅ Solo público: si está logueado -> /app/inicio */}
      <Route
        path="/login"
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

      {/* ✅ APP protegida + layout con navbar */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* default de /app */}
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
