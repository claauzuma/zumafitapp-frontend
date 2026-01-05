// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";

import Bienvenida from "./bienvenida.jsx";
import AuthPage from "./AuthPage.jsx";

import ProtectedRoute from "./ProtectedRoute.jsx";
import PublicOnlyRoute from "./PublicOnlyRoute.jsx";

import AppLayout from "./AppLayout.jsx"

// Pantallas del panel:
import InicioEntrenado from "./entrenado/InicioEntrenado.jsx"; // la vas a crear
import MenuEj from "./entrenado/MenuEj.jsx";

// (Opcional) otras:
import Perfil from "./entrenado/Perfil.jsx";
import Rutinas from "./entrenado/Rutinas.jsx";
import Progresos from "./entrenado/Progresos.jsx";
import Ajustes from "./entrenado/Ajustes.jsx";

export default function App() {
  return (
    <Routes>
      {/* Landing pública */}
      <Route path="/" element={<Bienvenida />} />

      {/* Solo público */}
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

      {/* APP protegida + layout con navbar */}
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

        {/* estas las dejás si ya existen o las creás */}
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
