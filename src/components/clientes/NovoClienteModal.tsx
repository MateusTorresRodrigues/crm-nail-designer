import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { registrarLog } from '@/lib/logs'
import { useAuth } from '@/contexts/AuthContext'
import type { Contato, Profissional } from '@/types/database'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface NovoClienteModalProps {
  aberto: boolean
  onOpenChange: (aberto: boolean) => void
  profissionais: Profissional[]
  onCriado: (cliente: Contato) => void
}

const SEM_SELECAO = '__nenhum__'

export default function NovoClienteModal({ aberto, onOpenChange, profissionais, onCriado }: NovoClienteModalProps) {
  const { user } = useAuth()
  const [whatsapp, setWhatsapp] = useState('')
  const [nome, setNome] = useState('')
  const [profissionalPreferida, setProfissionalPreferida] = useState(SEM_SELECAO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function fechar() {
    setWhatsapp('')
    setNome('')
    setProfissionalPreferida(SEM_SELECAO)
    setErro(null)
    onOpenChange(false)
  }

  async function criar() {
    if (!whatsapp.trim()) {
      setErro('Informe pelo menos o WhatsApp do cliente.')
      return
    }

    setSalvando(true)
    setErro(null)

    const dadosNovos = {
      whatsapp: whatsapp.trim(),
      nome: nome.trim() || null,
      profissional_preferida: profissionalPreferida === SEM_SELECAO ? null : profissionalPreferida,
      tipo: 'cliente' as const,
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
          : 'Não foi possível criar o cliente: ' + error?.message,
      )
      return
    }

    await registrarLog({
      usuarioId: user?.id,
      acao: 'criar_cliente',
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
          <DialogTitle>Novo cliente</DialogTitle>
          <DialogDescription>Cadastre um cliente manualmente, sem passar pelo funil de leads.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="whatsapp-novo-cliente">WhatsApp *</Label>
            <Input
              id="whatsapp-novo-cliente"
              placeholder="(11) 91234-5678"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nome-novo-cliente">Nome</Label>
            <Input id="nome-novo-cliente" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Profissional preferida</Label>
            <Select value={profissionalPreferida} onValueChange={setProfissionalPreferida}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma profissional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_SELECAO}>Nenhuma</SelectItem>
                {profissionais.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            {salvando ? 'Criando...' : 'Criar cliente'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
