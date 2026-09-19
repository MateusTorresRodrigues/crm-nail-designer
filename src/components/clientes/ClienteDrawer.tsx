import { useEffect, useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { registrarLog } from '@/lib/logs'
import { formatarData, formatarValor } from '@/lib/date'
import { useAuth } from '@/contexts/AuthContext'
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext'
import type { Contato, Profissional, Servico } from '@/types/database'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface ItemHistorico {
  id: string
  tipo: 'agendamento' | 'comanda'
  data: string
  servico: string | null
  profissional: string | null
  valor: number | null
}

interface ClienteDrawerProps {
  cliente: Contato | null
  aberto: boolean
  onOpenChange: (aberto: boolean) => void
  profissionais: Profissional[]
  servicos: Servico[]
  onAtualizado: () => void
  onExcluido: () => void
}

const SEM_SELECAO = '__nenhum__'

export default function ClienteDrawer({
  cliente,
  aberto,
  onOpenChange,
  profissionais,
  servicos,
  onAtualizado,
  onExcluido,
}: ClienteDrawerProps) {
  const { user } = useAuth()
  const { confirmarExclusao } = useConfirmDialog()

  const [nome, setNome] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [profissionalPreferida, setProfissionalPreferida] = useState<string>(SEM_SELECAO)
  const [servicoInteresse, setServicoInteresse] = useState<string>(SEM_SELECAO)

  const [salvando, setSalvando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [historico, setHistorico] = useState<ItemHistorico[]>([])
  const [carregandoHistorico, setCarregandoHistorico] = useState(false)

  useEffect(() => {
    if (!cliente) return
    setNome(cliente.nome ?? '')
    setWhatsapp(cliente.whatsapp)
    setObservacoes(cliente.observacoes ?? '')
    setProfissionalPreferida(cliente.profissional_preferida ?? SEM_SELECAO)
    setServicoInteresse(cliente.servico_interesse ?? SEM_SELECAO)
  }, [cliente])

  useEffect(() => {
    if (!cliente || !aberto) return

    let ativo = true
    setCarregandoHistorico(true)

    async function carregarHistorico() {
      const [respAgendamentos, respComandas] = await Promise.all([
        supabase
          .from('agendamentos')
          .select('id, data_hora_inicio, servicos(nome), profissionais(nome)')
          .eq('id_cliente', cliente!.id)
          .eq('status', 'concluido')
          .order('data_hora_inicio', { ascending: false }),
        supabase
          .from('comandas')
          .select('id, created_at, valor_total, profissionais(nome)')
          .eq('id_cliente', cliente!.id)
          .eq('status', 'fechada')
          .order('created_at', { ascending: false }),
      ])

      if (!ativo) return

      const itensAgendamentos: ItemHistorico[] = (respAgendamentos.data ?? []).map((item) => ({
        id: item.id,
        tipo: 'agendamento',
        data: item.data_hora_inicio,
        servico: (item.servicos as unknown as { nome: string } | null)?.nome ?? null,
        profissional: (item.profissionais as unknown as { nome: string } | null)?.nome ?? null,
        valor: null,
      }))

      const itensComandas: ItemHistorico[] = (respComandas.data ?? []).map((item) => ({
        id: item.id,
        tipo: 'comanda',
        data: item.created_at,
        servico: null,
        profissional: (item.profissionais as unknown as { nome: string } | null)?.nome ?? null,
        valor: item.valor_total,
      }))

      const combinado = [...itensAgendamentos, ...itensComandas].sort(
        (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime(),
      )

      setHistorico(combinado)
      setCarregandoHistorico(false)
    }

    carregarHistorico()

    return () => {
      ativo = false
    }
  }, [cliente, aberto])

  if (!cliente) return null

  async function salvar() {
    if (!cliente) return
    setSalvando(true)

    const dadosNovos = {
      nome: nome.trim() || null,
      whatsapp: whatsapp.trim(),
      observacoes: observacoes.trim() || null,
      profissional_preferida: profissionalPreferida === SEM_SELECAO ? null : profissionalPreferida,
      servico_interesse: servicoInteresse === SEM_SELECAO ? null : servicoInteresse,
    }

    const { error } = await supabase.from('crm_naildesigner').update(dadosNovos).eq('id', cliente.id)

    setSalvando(false)

    if (error) {
      alert('Não foi possível salvar as alterações: ' + error.message)
      return
    }

    await registrarLog({
      usuarioId: user?.id,
      acao: 'atualizar_cliente',
      tabela: 'crm_naildesigner',
      idRegistro: cliente.id,
      dadosAnteriores: cliente,
      dadosNovos,
    })

    onAtualizado()
    onOpenChange(false)
  }

  async function excluir() {
    if (!cliente) return
    const confirmado = await confirmarExclusao({
      titulo: 'Excluir cliente',
      descricao: `Tem certeza que deseja excluir ${cliente.nome || cliente.whatsapp}? Essa ação não pode ser desfeita.`,
    })
    if (!confirmado) return

    setExcluindo(true)
    const { error } = await supabase.from('crm_naildesigner').delete().eq('id', cliente.id)
    setExcluindo(false)

    if (error) {
      alert('Não foi possível excluir o cliente: ' + error.message)
      return
    }

    await registrarLog({
      usuarioId: user?.id,
      acao: 'excluir_cliente',
      tabela: 'crm_naildesigner',
      idRegistro: cliente.id,
      dadosAnteriores: cliente,
    })

    onExcluido()
    onOpenChange(false)
  }

  return (
    <Sheet open={aberto} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{cliente.nome || cliente.whatsapp}</SheetTitle>
          <SheetDescription>Cliente desde {formatarData(cliente.created_at)}</SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="nome-cliente">Nome</Label>
            <Input id="nome-cliente" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp-cliente">WhatsApp</Label>
            <Input id="whatsapp-cliente" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
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

          <div className="space-y-2">
            <Label>Serviço de interesse</Label>
            <Select value={servicoInteresse} onValueChange={setServicoInteresse}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um serviço" />
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

          <div className="space-y-2">
            <Label htmlFor="observacoes-cliente">Observações</Label>
            <Textarea
              id="observacoes-cliente"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button onClick={salvar} disabled={salvando} className="flex-1">
              {salvando ? 'Salvando...' : 'Salvar alterações'}
            </Button>
            <Button variant="destructive" onClick={excluir} disabled={excluindo} size="icon">
              {excluindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>

          <div className="border-t border-border pt-5">
            <h3 className="mb-3 font-serif text-lg font-semibold text-foreground">
              Histórico de atendimentos
            </h3>

            {carregandoHistorico && (
              <p className="text-sm text-muted-foreground">Carregando histórico...</p>
            )}

            {!carregandoHistorico && historico.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Ainda não há atendimentos concluídos para este cliente.
              </p>
            )}

            {!carregandoHistorico && historico.length > 0 && (
              <ul className="space-y-2">
                {historico.map((item) => (
                  <li
                    key={`${item.tipo}-${item.id}`}
                    className="rounded-xl border border-border bg-background px-4 py-3 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">
                        {item.servico ?? (item.tipo === 'comanda' ? 'Comanda' : 'Atendimento')}
                      </span>
                      <span className="text-muted-foreground">{formatarData(item.data)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-muted-foreground">
                      <span>{item.profissional ?? '—'}</span>
                      {item.valor !== null && <span>{formatarValor(item.valor)}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
