import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Bienvenida from "./bienvenida.jsx";
import AuthPage from "./AuthPage.jsx";

import ProtectedRoute from "./ProtectedRoute.jsx";
import PublicOnlyRoute from "./PublicOnlyRoute.jsx";
import RequireRole from "./RequireRole.jsx";
import RequireOnboarding from "./RequireOnboarding.jsx";

import CrearUsuario from "./admin/CrearUsuario.jsx";
import AppLayout from "./AppLayout.jsx";
import AdminLayout from "./admin/AdminLayout.jsx";

import ProfesionalLayout from "./profesional/ProfesionalLayout.jsx";
import InicioProfesional from "./profesional/InicioProfesional.jsx";

// ✅ Onboarding v2 (wizard con basics/goal/program)
import OnboardingWizard from "./onboarding_v2/OnboardingWizard.jsx";

// ✅ Cliente (entrenado)
import InicioEntrenado from "./entrenado/InicioEntrenado.jsx";

// ✅ Menú con tabs
import MenuEj from "./entrenado/MenuEj.jsx";
import MenuPlan from "./entrenado/menu/MenuPlan.jsx";
import MenuPreferencias from "./entrenado/menu/MenuPreferencias.jsx";
import MenuFavoritas from "./entrenado/menu/MenuFavoritas.jsx";

import Perfil from "./entrenado/Perfil.jsx";
import Rutinas from "./entrenado/Rutinas.jsx";
import Progresos from "./entrenado/Progresos.jsx";
import Ajustes from "./entrenado/Ajustes.jsx";

// ✅ Admin
import AdminInicio from "./admin/AdminInicio.jsx";
import AdminUsuarios from "./admin/AdminUsuarios.jsx";
import AdminInvitaciones from "./admin/AdminInvitaciones.jsx";
import AdminUsuarioDetalle from "./admin/AdminUsuarioDetalle.jsx";
import AdminComidas from "./admin/AdminComidas.jsx";
import AdminAlimentos from "./admin/AdminAlimentos.jsx";
import AdminRutinas from "./admin/AdminRutinas.jsx";

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
        <Route path="usuarios/invitaciones" element={<AdminInvitaciones />} />
        <Route path="usuarios/crear" element={<CrearUsuario />} />
        <Route path="usuarios/:id" element={<AdminUsuarioDetalle />} />
        <Route path="comidas" element={<AdminComidas />} />
        <Route path="alimentos" element={<AdminAlimentos />} />
        <Route path="rutinas" element={<AdminRutinas />} />
      </Route>

      {/* ✅ PROFESIONAL */}
      <Route
        path="/profesional"
        element={
          <ProtectedRoute>
            <RequireRole role="coach">
              <ProfesionalLayout />
            </RequireRole>
          </ProtectedRoute>
        }
      >
        <Route index element={<InicioProfesional />} />
        {/* <Route path="clientes" element={<ClientesProfesional />} /> */}
        {/* <Route path="rutinas" element={<RutinasProfesional />} /> */}
        {/* <Route path="menus" element={<MenusProfesional />} /> */}
        {/* <Route path="perfil" element={<PerfilProfesional />} /> */}
      </Route>

      {/* ✅ APP (CLIENTE) */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <RequireOnboarding>
              <AppLayout />
            </RequireOnboarding>
          </ProtectedRoute>
        }
      >
        <Route path="onboarding/*" element={<OnboardingWizard />} />
        <Route index element={<Navigate to="inicio" replace />} />
        <Route path="inicio" element={<InicioEntrenado />} />

        <Route path="menu" element={<MenuEj />}>
          <Route index element={<MenuPlan />} />
          <Route path="preferencias" element={<MenuPreferencias />} />
          <Route path="favoritas" element={<MenuFavoritas />} />
        </Route>

        <Route path="perfil" element={<Perfil />} />
        <Route path="rutinas" element={<Rutinas />} />
        <Route path="progresos" element={<Progresos />} />
        <Route path="ajustes" element={<Ajustes />} />

        <Route path="*" element={<Navigate to="/app/inicio" replace />} />
      </Route>

      {/* fallback global */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
