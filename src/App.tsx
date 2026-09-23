import { HashRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Vendas from "@/pages/Vendas";
import Checklist from "@/pages/Checklist";
import Atendimento from "@/pages/Atendimento";
import Sdr from "@/pages/Sdr";
import Financeiro from "@/pages/Financeiro";
import Producao from "@/pages/Producao";
import P4F from "@/pages/P4F";
import ContasPagar from "@/pages/ContasPagar";
import Lucro from "@/pages/Lucro";
import Configuracoes from "@/pages/Configuracoes";
import ModulePlaceholder from "@/pages/ModulePlaceholder";

export default function App() {
  return (
    <ThemeProvider>
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
      </HashRouter>
    </AuthProvider>
    </ThemeProvider>
  );
}
