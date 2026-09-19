import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ConfiguracaoProvider } from '@/contexts/ConfiguracaoContext'
import { ConfirmDialogProvider } from '@/contexts/ConfirmDialogContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import Layout from '@/components/layout/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Clientes from '@/pages/Clientes'
import Leads from '@/pages/Leads'
import Agenda from '@/pages/Agenda'
import Profissionais from '@/pages/Profissionais'
import Servicos from '@/pages/Servicos'
import Comandas from '@/pages/Comandas'
import Produtos from '@/pages/Produtos'
import Retorno from '@/pages/Retorno'
import Pagamentos from '@/pages/Pagamentos'
import Configuracoes from '@/pages/Configuracoes'
import Logs from '@/pages/Logs'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ConfiguracaoProvider>
          <ConfirmDialogProvider>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<Dashboard />} />
                <Route path="/agenda" element={<Agenda />} />
                <Route path="/clientes" element={<Clientes />} />
                <Route path="/leads" element={<Leads />} />
                <Route path="/profissionais" element={<Profissionais />} />
                <Route path="/servicos" element={<Servicos />} />
                <Route path="/produtos" element={<Produtos />} />
                <Route path="/comandas" element={<Comandas />} />
                <Route path="/retorno" element={<Retorno />} />
                <Route path="/pagamentos" element={<Pagamentos />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
                <Route path="/logs" element={<Logs />} />
              </Route>
            </Routes>
          </ConfirmDialogProvider>
        </ConfiguracaoProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
