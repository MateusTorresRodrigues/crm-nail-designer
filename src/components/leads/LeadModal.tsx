import { useEffect, useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { registrarLog } from '@/lib/logs'
import { useAuth } from '@/contexts/AuthContext'
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext'
import type { Classificacao, Contato, Profissional, Servico, StatusContato } from '@/types/database'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { COLUNAS_KANBAN } from './kanban-config'
import { CLASSIFICACOES } from './classificacao-config'

const SEM_SELECAO = '__nenhum__'

interface LeadModalProps {
  lead: Contato | null
  aberto: boolean
  onOpenChange: (aberto: boolean) => void
  profissionais: Profissional[]
  servicos: Servico[]
  onAtualizado: (lead: Contato) => void
  onExcluido: (id: string) => void
}

export default function LeadModal({
  lead,
  aberto,
  onOpenChange,
  profissionais,
  servicos,
  onAtualizado,
  onExcluido,
}: LeadModalProps) {
  const { user } = useAuth()
  const { confirmarExclusao } = useConfirmDialog()

  const [nome, setNome] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [status, setStatus] = useState<StatusContato>('novo')
  const [origem, setOrigem] = useState('')
  const [motivoContato, setMotivoContato] = useState('')
  const [resumoConversa, setResumoConversa] = useState('')
  const [profissionalPreferida, setProfissionalPreferida] = useState(SEM_SELECAO)
  const [servicoInteresse, setServicoInteresse] = useState(SEM_SELECAO)
  const [horarioPreferencia, setHorarioPreferencia] = useState('')
  const [classificacao, setClassificacao] = useState<Classificacao>('frio')
  const [observacoes, setObservacoes] = useState('')

  const [salvando, setSalvando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  useEffect(() => {
    if (!lead) return
    setNome(lead.nome ?? '')
    setWhatsapp(lead.whatsapp)
    setStatus(lead.status)
    setOrigem(lead.origem ?? '')
    setMotivoContato(lead.motivo_contato ?? '')
    setResumoConversa(lead.resumo_conversa ?? '')
    setProfissionalPreferida(lead.profissional_preferida ?? SEM_SELECAO)
    setServicoInteresse(lead.servico_interesse ?? SEM_SELECAO)
    setHorarioPreferencia(lead.horario_preferencia ?? '')
    setClassificacao(lead.classificacao)
    setObservacoes(lead.observacoes ?? '')
  }, [lead])

  if (!lead) return null

  async function salvar() {
    if (!lead) return

    const camposAtuais = {
      nome: nome.trim() || null,
      whatsapp: whatsapp.trim(),
      status,
      origem: origem.trim() || null,
      motivo_contato: motivoContato.trim() || null,
      resumo_conversa: resumoConversa.trim() || null,
      profissional_preferida: profissionalPreferida === SEM_SELECAO ? null : profissionalPreferida,
      servico_interesse: servicoInteresse === SEM_SELECAO ? null : servicoInteresse,
      horario_preferencia: horarioPreferencia.trim() || null,
      classificacao,
      observacoes: observacoes.trim() || null,
    }

    // Envia somente os campos que de fato mudaram: assim, se apenas a classificação for
    // ajustada manualmente, o trigger de reclassificação automática (que observa
    // servico_interesse/profissional_preferida/horario_preferencia) não é disparado.
    const dadosNovos: Partial<typeof camposAtuais> = {}
    for (const chave of Object.keys(camposAtuais) as (keyof typeof camposAtuais)[]) {
      if (camposAtuais[chave] !== (lead[chave] ?? null)) {
        ;(dadosNovos as Record<string, unknown>)[chave] = camposAtuais[chave]
      }
    }

    if (Object.keys(dadosNovos).length === 0) {
      onOpenChange(false)
      return
    }

    setSalvando(true)

    const { data, error } = await supabase
      .from('crm_naildesigner')
      .update(dadosNovos)
      .eq('id', lead.id)
      .select()
      .single()

    setSalvando(false)

    if (error || !data) {
      alert('Não foi possível salvar as alterações: ' + error?.message)
      return
    }

    await registrarLog({
      usuarioId: user?.id,
      acao: 'atualizar_lead',
      tabela: 'crm_naildesigner',
      idRegistro: lead.id,
      dadosAnteriores: lead,
      dadosNovos,
    })

    onAtualizado(data as Contato)
    onOpenChange(false)
  }

  async function excluir() {
    if (!lead) return
    const confirmado = await confirmarExclusao({
      titulo: 'Excluir lead',
      descricao: `Tem certeza que deseja excluir ${lead.nome || lead.whatsapp}? Essa ação não pode ser desfeita.`,
    })
    if (!confirmado) return

    setExcluindo(true)
    const { error } = await supabase.from('crm_naildesigner').delete().eq('id', lead.id)
    setExcluindo(false)

    if (error) {
      alert('Não foi possível excluir o lead: ' + error.message)
      return
    }

    await registrarLog({
      usuarioId: user?.id,
      acao: 'excluir_lead',
      tabela: 'crm_naildesigner',
      idRegistro: lead.id,
      dadosAnteriores: lead,
    })

    onExcluido(lead.id)
    onOpenChange(false)
  }

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead.nome || lead.whatsapp}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="nome-lead">Nome</Label>
              <Input id="nome-lead" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp-lead">WhatsApp</Label>
              <Input id="whatsapp-lead" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as StatusContato)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLUNAS_KANBAN.map((coluna) => (
                    <SelectItem key={coluna.status} value={coluna.status}>
                      {coluna.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="origem-lead">Origem</Label>
              <Input id="origem-lead" value={origem} onChange={(e) => setOrigem(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="motivo-lead">Motivo do contato</Label>
            <Textarea
              id="motivo-lead"
              value={motivoContato}
              onChange={(e) => setMotivoContato(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="resumo-lead">Resumo da conversa</Label>
            <Textarea
              id="resumo-lead"
              value={resumoConversa}
              onChange={(e) => setResumoConversa(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Profissional preferida</Label>
              <Select value={profissionalPreferida} onValueChange={setProfissionalPreferida}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma" />
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
            <div className="space-y-2">
              <Label>Serviço de interesse</Label>
              <Select value={servicoInteresse} onValueChange={setServicoInteresse}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_SELECAO}>Nenhum</SelectItem>
                  {servicos.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="horario-lead">Horário de preferência</Label>
              <Input
                id="horario-lead"
                placeholder="Ex.: terças à tarde"
                value={horarioPreferencia}
                onChange={(e) => setHorarioPreferencia(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Classificação</Label>
              <Select value={classificacao} onValueChange={(v) => setClassificacao(v as Classificacao)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLASSIFICACOES.map((c) => (
                    <SelectItem key={c.valor} value={c.valor}>
                      {c.emoji} {c.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes-lead">Observações</Label>
            <Textarea
              id="observacoes-lead"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <Button variant="destructive" onClick={excluir} disabled={excluindo} size="icon">
            {excluindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
