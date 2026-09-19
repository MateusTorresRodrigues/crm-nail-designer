import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useConfiguracao } from '@/contexts/ConfiguracaoContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Login() {
  const { session, entrar } = useAuth()
  const { nomeNegocio, logoUrl } = useConfiguracao()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (session) {
    const destino = (location.state as { de?: string } | null)?.de ?? '/'
    return <Navigate to={destino} replace />
  }

  async function lidarComEnvio(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)
    setCarregando(true)

    const { erro: erroLogin } = await entrar(email, senha)

    if (erroLogin) {
      setErro(erroLogin)
    }
    setCarregando(false)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-accent/15 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-secondary/40 blur-3xl" />

      <Card className="relative z-10 w-full max-w-md border-border/60 shadow-soft">
        <CardHeader className="items-center text-center">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={nomeNegocio}
              className="mb-3 h-16 w-16 rounded-full object-cover shadow-soft"
            />
          ) : (
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft">
              <Sparkles className="h-7 w-7" />
            </div>
          )}
          <CardTitle className="text-2xl">{nomeNegocio}</CardTitle>
          <CardDescription>Entre com suas credenciais para acessar o sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={lidarComEnvio} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(evento) => setEmail(evento.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={senha}
                onChange={(evento) => setSenha(evento.target.value)}
                required
              />
            </div>

            {erro && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {erro}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={carregando}>
              {carregando ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
