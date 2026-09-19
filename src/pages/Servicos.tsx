import { useEffect, useState } from 'react'
import { Plus, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { registrarLog } from '@/lib/logs'
import { formatarValor } from '@/lib/date'
import { useAuth } from '@/contexts/AuthContext'
import { useConfiguracao } from '@/contexts/ConfiguracaoContext'
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext'
import type { Servico } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import ServicoModal from '@/components/servicos/ServicoModal'

export default function Servicos() {
  const { user } = useAuth()
  const { configuracao } = useConfiguracao()
  const { confirmarExclusao } = useConfirmDialog()

  const [servicos, setServicos] = useState<Servico[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [selecionado, setSelecionado] = useState<Servico | null>(null)

  const diasInatividadePadrao = configuracao?.dias_inatividade ?? 30

  async function carregar() {
    setCarregando(true)
    const { data } = await supabase.from('servicos').select('*').order('nome')
    setServicos(data ?? [])
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  function abrirCriacao() {
    setSelecionado(null)
    setModalAberto(true)
  }

  function abrirEdicao(servico: Servico) {
    setSelecionado(servico)
    setModalAberto(true)
  }

  async function alternarAtivo(servico: Servico) {
    const novoValor = !servico.ativo
    setServicos((atual) => atual.map((s) => (s.id === servico.id ? { ...s, ativo: novoValor } : s)))

    const { error } = await supabase.from('servicos').update({ ativo: novoValor }).eq('id', servico.id)

    if (error) {
      setServicos((atual) => atual.map((s) => (s.id === servico.id ? { ...s, ativo: servico.ativo } : s)))
      alert('Não foi possível atualizar o status: ' + error.message)
      return
    }

    await registrarLog({
      usuarioId: user?.id,
      acao: novoValor ? 'ativar_servico' : 'desativar_servico',
      tabela: 'servicos',
      idRegistro: servico.id,
      dadosAnteriores: { ativo: servico.ativo },
      dadosNovos: { ativo: novoValor },
    })
  }

  async function excluir(servico: Servico) {
    const confirmado = await confirmarExclusao({
      titulo: 'Excluir serviço',
      descricao: `Tem certeza que deseja excluir ${servico.nome}? Essa ação não pode ser desfeita.`,
    })
    if (!confirmado) return

    const { error } = await supabase.from('servicos').delete().eq('id', servico.id)

    if (error) {
      alert(
        'Não foi possível excluir: ' +
          (error.message.includes('foreign key')
            ? 'este serviço está vinculado a agendamentos ou comandas existentes. Desative-o em vez de excluir.'
            : error.message),
      )
      return
    }

    await registrarLog({
      usuarioId: user?.id,
      acao: 'excluir_servico',
      tabela: 'servicos',
      idRegistro: servico.id,
      dadosAnteriores: servico,
    })

    carregar()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <Button onClick={abrirCriacao} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo serviço
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {carregando && (
            <p className="p-8 text-center text-sm text-muted-foreground">Carregando serviços...</p>
          )}

          {!carregando && servicos.length === 0 && (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <Sparkles className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium text-foreground">Nenhum serviço cadastrado ainda</p>
              <p className="text-sm text-muted-foreground">
                Cadastre os procedimentos oferecidos pela clínica para começar a montar a agenda.
              </p>
            </div>
          )}

          {!carregando && servicos.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Nome</th>
                    <th className="px-5 py-3 font-medium">Duração</th>
                    <th className="px-5 py-3 font-medium">Valor</th>
                    <th className="px-5 py-3 font-medium">Dias para retorno</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {servicos.map((servico) => (
                    <tr
                      key={servico.id}
                      className="border-b border-border/60 last:border-0 hover:bg-muted/60"
                    >
                      <td
                        className="cursor-pointer px-5 py-3 font-medium text-foreground"
                        onClick={() => abrirEdicao(servico)}
                      >
                        {servico.nome}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{servico.duracao_minutos} min</td>
                      <td className="px-5 py-3 text-muted-foreground">{formatarValor(servico.valor)}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {servico.dias_retorno
                          ? `${servico.dias_retorno} dias`
                          : `Padrão (${diasInatividadePadrao} dias)`}
                      </td>
                      <td className="px-5 py-3">
                        <button onClick={() => alternarAtivo(servico)}>
                          <Badge variant={servico.ativo ? 'accent' : 'outline'}>
                            {servico.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </button>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => abrirEdicao(servico)}>
                            Editar
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => excluir(servico)}>
                            Excluir
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ServicoModal
        servico={selecionado}
        aberto={modalAberto}
        onOpenChange={setModalAberto}
        onSalvo={carregar}
        diasInatividadePadrao={diasInatividadePadrao}
      />
    </div>
  )
}
