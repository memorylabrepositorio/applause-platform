import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import ModulePlaceholder from "@/pages/ModulePlaceholder";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
                <ModulePlaceholder title="Painel de Vendas" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/checklist"
            element={
              <ProtectedRoute>
                <ModulePlaceholder title="Checklist de Solenidade" />
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
      </BrowserRouter>
    </AuthProvider>
  );
}
