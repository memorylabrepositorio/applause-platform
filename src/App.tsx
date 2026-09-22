import { HashRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Vendas from "@/pages/Vendas";
import Checklist from "@/pages/Checklist";
import ModulePlaceholder from "@/pages/ModulePlaceholder";

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
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
                <ModulePlaceholder title="CRM de Atendimento" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sdr"
            element={
              <ProtectedRoute>
                <ModulePlaceholder title="SDR (Agente de IA)" />
              </ProtectedRoute>
            }
          />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
