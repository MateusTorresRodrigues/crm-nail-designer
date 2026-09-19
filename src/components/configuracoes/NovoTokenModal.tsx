import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { registrarLog } from '@/lib/logs'
import { gerarToken } from '@/lib/gerar-token'
import { useAuth } from '@/contexts/AuthContext'
import type { ApiToken } from '@/types/database'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface NovoTokenModalProps {
  aberto: boolean
  onOpenChange: (aberto: boolean) => void
  onCriado: (token: ApiToken) => void
}

export default function NovoTokenModal({ aberto, onOpenChange, onCriado }: NovoTokenModalProps) {
  const { user } = useAuth()
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function fechar() {
    setNome('')
    setErro(null)
    onOpenChange(false)
  }

  async function criar() {
    if (!nome.trim()) {
      setErro('Dê um nome ao token (ex.: "Agente WhatsApp n8n").')
      return
    }

    setSalvando(true)
    setErro(null)

    const dadosNovos = { nome: nome.trim(), token: gerarToken(), ativo: true }

    const { data, error } = await supabase.from('api_tokens').insert(dadosNovos).select().single()

    setSalvando(false)

    if (error || !data) {
      setErro('Não foi possível criar o token: ' + error?.message)
      return
    }

    await registrarLog({
      usuarioId: user?.id,
      acao: 'criar_api_token',
      tabela: 'api_tokens',
      idRegistro: data.id,
      dadosNovos: { nome: dadosNovos.nome, ativo: dadosNovos.ativo },
    })

    onCriado(data as ApiToken)
    fechar()
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && fechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo token de API</DialogTitle>
          <DialogDescription>
            Use um nome que identifique onde ele será usado, por exemplo o fluxo do n8n.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="nome-token">Nome</Label>
          <Input
            id="nome-token"
            placeholder="Agente WhatsApp n8n"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          {erro && <p className="text-sm text-destructive">{erro}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={fechar}>
            Cancelar
          </Button>
          <Button onClick={criar} disabled={salvando}>
            {salvando ? 'Criando...' : 'Criar token'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
