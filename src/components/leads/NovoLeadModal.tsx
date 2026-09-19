import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { registrarLog } from '@/lib/logs'
import { useAuth } from '@/contexts/AuthContext'
import type { Contato } from '@/types/database'
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

interface NovoLeadModalProps {
  aberto: boolean
  onOpenChange: (aberto: boolean) => void
  onCriado: (lead: Contato) => void
}

export default function NovoLeadModal({ aberto, onOpenChange, onCriado }: NovoLeadModalProps) {
  const { user } = useAuth()
  const [whatsapp, setWhatsapp] = useState('')
  const [nome, setNome] = useState('')
  const [origem, setOrigem] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function fechar() {
    setWhatsapp('')
    setNome('')
    setOrigem('')
    setErro(null)
    onOpenChange(false)
  }

  async function criar() {
    if (!whatsapp.trim()) {
      setErro('Informe pelo menos o WhatsApp do lead.')
      return
    }

    setSalvando(true)
    setErro(null)

    const dadosNovos = {
      whatsapp: whatsapp.trim(),
      nome: nome.trim() || null,
      origem: origem.trim() || null,
      tipo: 'lead' as const,
      status: 'novo' as const,
    }

    const { data, error } = await supabase
      .from('crm_naildesigner')
      .insert(dadosNovos)
      .select()
      .single()

    setSalvando(false)

    if (error || !data) {
      setErro(
        error?.code === '23505'
          ? 'Já existe um contato cadastrado com esse WhatsApp.'
          : 'Não foi possível criar o lead: ' + error?.message,
      )
      return
    }

    await registrarLog({
      usuarioId: user?.id,
      acao: 'criar_lead',
      tabela: 'crm_naildesigner',
      idRegistro: data.id,
      dadosNovos,
    })

    onCriado(data as Contato)
    fechar()
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && fechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo lead</DialogTitle>
          <DialogDescription>Cadastre um novo contato manualmente.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="whatsapp-novo-lead">WhatsApp *</Label>
            <Input
              id="whatsapp-novo-lead"
              placeholder="(11) 91234-5678"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nome-novo-lead">Nome</Label>
            <Input id="nome-novo-lead" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="origem-novo-lead">Origem</Label>
            <Input
              id="origem-novo-lead"
              placeholder="Instagram, indicação, site..."
              value={origem}
              onChange={(e) => setOrigem(e.target.value)}
            />
          </div>

          {erro && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={fechar}>
            Cancelar
          </Button>
          <Button onClick={criar} disabled={salvando}>
            {salvando ? 'Criando...' : 'Criar lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
