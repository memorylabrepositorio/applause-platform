import { lazy, Suspense } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "@/pages/Login";

// cada painel vira seu próprio pedaço de JS, carregado só quando o usuário
// entra nele — em vez de um bundle único de ~1.4MB no primeiro acesso
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Mapa = lazy(() => import("@/pages/Mapa"));
const Vendas = lazy(() => import("@/pages/Vendas"));
const Checklist = lazy(() => import("@/pages/Checklist"));
const Atendimento = lazy(() => import("@/pages/Atendimento"));
const Sdr = lazy(() => import("@/pages/Sdr"));
const Financeiro = lazy(() => import("@/pages/Financeiro"));
const Producao = lazy(() => import("@/pages/Producao"));
const P4F = lazy(() => import("@/pages/P4F"));
const ContasPagar = lazy(() => import("@/pages/ContasPagar"));
const Lucro = lazy(() => import("@/pages/Lucro"));
const Configuracoes = lazy(() => import("@/pages/Configuracoes"));

function PageFallback() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-ink-950">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
    </div>
  );
}

// respeita a página inicial escolhida em Configurações > Aparência
function Home() {
  const { defaultRoute } = useTheme();
  if (defaultRoute && defaultRoute !== "/") return <Navigate to={defaultRoute} replace />;
  return <Mapa />;
}

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <HashRouter>
        <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mapa"
            element={
              <ProtectedRoute>
                <Mapa />
              </ProtectedRoute>
            }
          />
          <Route
            path="/modulos"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendas"
            element={
              <ProtectedRoute>
                <Vendas />
              </ProtectedRoute>
            }
          />
          <Route
            path="/checklist"
            element={
              <ProtectedRoute>
                <Checklist />
              </ProtectedRoute>
            }
          />
          <Route
            path="/atendimento"
            element={
              <ProtectedRoute>
                <Atendimento />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sdr"
            element={
              <ProtectedRoute>
                <Sdr />
              </ProtectedRoute>
            }
          />
          <Route
            path="/financeiro"
            element={
              <ProtectedRoute>
                <Financeiro />
              </ProtectedRoute>
            }
          />
          <Route
            path="/producao"
            element={
              <ProtectedRoute>
                <Producao />
              </ProtectedRoute>
            }
          />
          <Route
            path="/p4f"
            element={
              <ProtectedRoute>
                <P4F />
              </ProtectedRoute>
            }
          />
          <Route
            path="/contas-pagar"
            element={
              <ProtectedRoute>
                <ContasPagar />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lucro"
            element={
              <ProtectedRoute>
                <Lucro />
              </ProtectedRoute>
            }
          />
          <Route
            path="/configuracoes"
            element={
              <ProtectedRoute>
                <Configuracoes />
              </ProtectedRoute>
            }
          />
        </Routes>
        </Suspense>
      </HashRouter>
    </AuthProvider>
    </ThemeProvider>
  );
}
