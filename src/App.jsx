import React, { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "./ProtectedRoute.jsx";
import PublicOnlyRoute from "./PublicOnlyRoute.jsx";
import RequireOnboarding from "./RequireOnboarding.jsx";
import RequireRole from "./RequireRole.jsx";
import { RouteChunkErrorBoundary, RouteLoadingFallback } from "./routes/RouteLoading.jsx";

const Bienvenida = lazy(() => import("./bienvenida.jsx"));
const AuthPage = lazy(() => import("./AuthPage.jsx"));
const RegistroProfesional = lazy(() => import("./profesional/RegistroProfesional.jsx"));

const AppLayout = lazy(() => import("./AppLayout.jsx"));
const OnboardingWizard = lazy(() => import("./onboarding_v2/OnboardingWizard.jsx"));
const InicioEntrenado = lazy(() => import("./entrenado/InicioEntrenado.jsx"));
const Objetivos = lazy(() => import("./entrenado/Objetivos.jsx"));
const MenuEj = lazy(() => import("./entrenado/MenuEj.jsx"));
const MenuPlan = lazy(() => import("./entrenado/menu/MenuPlan.jsx"));
const MenuPreferencias = lazy(() => import("./entrenado/menu/MenuPreferencias.jsx"));
const MenuFavoritas = lazy(() => import("./entrenado/menu/MenuFavoritas.jsx"));
const Perfil = lazy(() => import("./entrenado/Perfil.jsx"));
const Rutinas = lazy(() => import("./entrenado/Rutinas.jsx"));
const Progresos = lazy(() => import("./entrenado/Progresos.jsx"));
const Ajustes = lazy(() => import("./entrenado/Ajustes.jsx"));
const TrackingDiario = lazy(() => import("./entrenado/TrackingDiario.jsx"));
const NutritionLibraryPage = lazy(() => import("./nutritionLibrary/NutritionLibraryPage.jsx"));
const ClientMenuCreatePage = lazy(() => import("./clientMenus/ClientMenuCreatePage.jsx"));
const ClientPlansPage = lazy(() => import("./clientPlans/ClientPlansPage.jsx"));

const AdminLayout = lazy(() => import("./admin/AdminLayout.jsx"));
const CrearUsuario = lazy(() => import("./admin/CrearUsuario.jsx"));
const AdminInicio = lazy(() => import("./admin/AdminInicio.jsx"));
const AdminUsuarios = lazy(() => import("./admin/AdminUsuarios.jsx"));
const AdminInvitaciones = lazy(() => import("./admin/AdminInvitaciones.jsx"));
const AdminUsuarioDetalle = lazy(() => import("./admin/AdminUsuarioDetalle.jsx"));
const AdminComidas = lazy(() => import("./admin/AdminComidas.jsx"));
const AdminAlimentos = lazy(() => import("./admin/AdminAlimentos.jsx"));
const AdminRutinas = lazy(() => import("./admin/AdminRutinas.jsx"));
const AdminCoachPlanes = lazy(() => import("./admin/AdminCoachPlanes.jsx"));
const AdminProfessionalAccess = lazy(() => import("./admin/AdminProfessionalAccess.jsx"));
const AdminSystem = lazy(() => import("./admin/AdminSystem.jsx"));

const ProfesionalLayout = lazy(() => import("./profesional/ProfesionalLayout.jsx"));
const InicioProfesional = lazy(() => import("./profesional/InicioProfesional.jsx"));
const ProfesionalPlaceholder = lazy(() => import("./profesional/ProfesionalPlaceholder.jsx"));
const ClientesProfesional = lazy(() => import("./profesional/ClientesProfesional.jsx"));
const ClienteDetalleProfesional = lazy(() => import("./profesional/ClienteDetalleProfesional.jsx"));
const PerfilProfesional = lazy(() => import("./profesional/PerfilProfesional.jsx"));
const RutinasProfesional = lazy(() => import("./profesional/RutinasProfesional.jsx"));
const AjustesProfesional = lazy(() => import("./profesional/AjustesProfesional.jsx"));
const MenusProfesional = lazy(() => import("./profesional/MenusProfesional.jsx"));

function LazyRoute({ children, label = "Cargando..." }) {
  return (
    <RouteChunkErrorBoundary>
      <Suspense fallback={<RouteLoadingFallback label={label} />}>
        {children}
      </Suspense>
    </RouteChunkErrorBoundary>
  );
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <PublicOnlyRoute>
            <LazyRoute label="Cargando inicio...">
              <Bienvenida />
            </LazyRoute>
          </PublicOnlyRoute>
        }
      />

      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LazyRoute label="Cargando acceso...">
              <AuthPage defaultMode="login" />
            </LazyRoute>
          </PublicOnlyRoute>
        }
      />

      <Route
        path="/auth/login"
        element={
          <PublicOnlyRoute>
            <LazyRoute label="Cargando acceso...">
              <AuthPage defaultMode="login" />
            </LazyRoute>
          </PublicOnlyRoute>
        }
      />

      <Route
        path="/auth"
        element={
          <PublicOnlyRoute>
            <LazyRoute label="Cargando acceso...">
              <AuthPage defaultMode="login" />
            </LazyRoute>
          </PublicOnlyRoute>
        }
      />

      <Route
        path="/auth/register"
        element={
          <PublicOnlyRoute>
            <LazyRoute label="Cargando registro...">
              <AuthPage defaultMode="select" />
            </LazyRoute>
          </PublicOnlyRoute>
        }
      />

      <Route
        path="/auth/register/client"
        element={
          <PublicOnlyRoute>
            <LazyRoute label="Cargando registro...">
              <AuthPage defaultMode="register" />
            </LazyRoute>
          </PublicOnlyRoute>
        }
      />

      <Route
        path="/auth/register/coach"
        element={
          <PublicOnlyRoute>
            <LazyRoute label="Cargando registro profesional...">
              <RegistroProfesional />
            </LazyRoute>
          </PublicOnlyRoute>
        }
      />

      <Route
        path="/forgot-password"
        element={
          <PublicOnlyRoute>
            <LazyRoute label="Cargando recuperacion...">
              <AuthPage defaultMode="login" />
            </LazyRoute>
          </PublicOnlyRoute>
        }
      />

      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <LazyRoute label="Cargando registro...">
              <AuthPage defaultMode="select" />
            </LazyRoute>
          </PublicOnlyRoute>
        }
      />

      <Route
        path="/registro-profesional"
        element={
          <PublicOnlyRoute>
            <LazyRoute label="Cargando registro profesional...">
              <RegistroProfesional />
            </LazyRoute>
          </PublicOnlyRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <RequireRole role="admin">
              <LazyRoute label="Cargando panel admin...">
                <AdminLayout />
              </LazyRoute>
            </RequireRole>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="inicio" replace />} />
        <Route path="inicio" element={<LazyRoute label="Cargando inicio admin..."><AdminInicio /></LazyRoute>} />
        <Route path="usuarios" element={<LazyRoute label="Cargando usuarios..."><AdminUsuarios /></LazyRoute>} />
        <Route path="usuarios/invitaciones" element={<LazyRoute label="Cargando invitaciones..."><AdminInvitaciones /></LazyRoute>} />
        <Route path="usuarios/crear" element={<LazyRoute label="Cargando creacion de usuario..."><CrearUsuario /></LazyRoute>} />
        <Route path="usuarios/:id" element={<LazyRoute label="Cargando usuario..."><AdminUsuarioDetalle /></LazyRoute>} />
        <Route path="comidas" element={<LazyRoute label="Cargando comidas..."><AdminComidas /></LazyRoute>} />
        <Route path="alimentos" element={<LazyRoute label="Cargando alimentos..."><AdminAlimentos /></LazyRoute>} />
        <Route path="rutinas" element={<LazyRoute label="Cargando rutinas..."><AdminRutinas /></LazyRoute>} />
        <Route path="coach-planes" element={<LazyRoute label="Cargando planes..."><AdminCoachPlanes /></LazyRoute>} />
        <Route path="profesionales" element={<LazyRoute label="Cargando profesionales..."><AdminProfessionalAccess /></LazyRoute>} />
        <Route path="sistema" element={<LazyRoute label="Cargando sistema..."><AdminSystem /></LazyRoute>} />
      </Route>

      <Route
        path="/profesional"
        element={
          <ProtectedRoute>
            <RequireRole role="coach">
              <LazyRoute label="Cargando panel profesional...">
                <ProfesionalLayout />
              </LazyRoute>
            </RequireRole>
          </ProtectedRoute>
        }
      >
        <Route index element={<LazyRoute label="Cargando profesional..."><InicioProfesional /></LazyRoute>} />
        <Route path="clientes" element={<LazyRoute label="Cargando clientes..."><ClientesProfesional /></LazyRoute>} />
        <Route path="clientes/:clientId" element={<LazyRoute label="Cargando cliente..."><ClienteDetalleProfesional /></LazyRoute>} />
        <Route path="rutinas" element={<LazyRoute label="Cargando rutinas..."><RutinasProfesional /></LazyRoute>} />
        <Route path="menus" element={<LazyRoute label="Cargando menus..."><MenusProfesional /></LazyRoute>} />
        <Route path="comidas" element={<LazyRoute label="Cargando biblioteca..."><NutritionLibraryPage mode="professional" /></LazyRoute>} />
        <Route path="progreso" element={<LazyRoute label="Cargando progreso..."><ProfesionalPlaceholder type="progreso" /></LazyRoute>} />
        <Route path="ajustes" element={<LazyRoute label="Cargando ajustes..."><AjustesProfesional /></LazyRoute>} />
        <Route path="perfil" element={<LazyRoute label="Cargando perfil..."><PerfilProfesional /></LazyRoute>} />
      </Route>

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <RequireRole role="cliente">
              <RequireOnboarding>
                <LazyRoute label="Cargando app...">
                  <AppLayout />
                </LazyRoute>
              </RequireOnboarding>
            </RequireRole>
          </ProtectedRoute>
        }
      >
        <Route path="onboarding/*" element={<LazyRoute label="Cargando onboarding..."><OnboardingWizard /></LazyRoute>} />
        <Route index element={<Navigate to="inicio" replace />} />
        <Route path="inicio" element={<LazyRoute label="Cargando inicio..."><InicioEntrenado /></LazyRoute>} />
        <Route path="objetivos" element={<LazyRoute label="Cargando objetivos..."><Objetivos /></LazyRoute>} />
        <Route path="menu/nuevo" element={<LazyRoute label="Cargando creador..."><ClientMenuCreatePage /></LazyRoute>} />

        <Route path="menu" element={<LazyRoute label="Cargando menu..."><MenuEj /></LazyRoute>}>
          <Route index element={<LazyRoute label="Cargando menu del dia..."><MenuPlan /></LazyRoute>} />
          <Route path="preferencias" element={<LazyRoute label="Cargando preferencias..."><MenuPreferencias /></LazyRoute>} />
          <Route path="favoritas" element={<LazyRoute label="Cargando favoritas..."><MenuFavoritas /></LazyRoute>} />
        </Route>

        <Route path="perfil" element={<LazyRoute label="Cargando perfil..."><Perfil /></LazyRoute>} />
        <Route path="rutinas" element={<LazyRoute label="Cargando rutinas..."><Rutinas /></LazyRoute>} />
        <Route path="tracking" element={<LazyRoute label="Cargando tracking..."><TrackingDiario /></LazyRoute>} />
        <Route path="nutricion" element={<LazyRoute label="Cargando nutricion..."><NutritionLibraryPage mode="client" /></LazyRoute>} />
        <Route path="planes" element={<LazyRoute label="Cargando plan..."><ClientPlansPage /></LazyRoute>} />
        <Route path="progresos" element={<LazyRoute label="Cargando progreso..."><Progresos /></LazyRoute>} />
        <Route path="ajustes" element={<LazyRoute label="Cargando ajustes..."><Ajustes /></LazyRoute>} />

        <Route path="*" element={<Navigate to="/app/inicio" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
