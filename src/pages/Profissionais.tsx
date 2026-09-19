import { useEffect, useState } from 'react'
import { Plus, UserCog } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { registrarLog } from '@/lib/logs'
import { useAuth } from '@/contexts/AuthContext'
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext'
import type { Profissional } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import ProfissionalModal from '@/components/profissionais/ProfissionalModal'

export default function Profissionais() {
  const { user } = useAuth()
  const { confirmarExclusao } = useConfirmDialog()

  const [profissionais, setProfissionais] = useState<Profissional[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [selecionada, setSelecionada] = useState<Profissional | null>(null)

  async function carregar() {
    setCarregando(true)
    const { data } = await supabase.from('profissionais').select('*').order('nome')
    setProfissionais(data ?? [])
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  function abrirCriacao() {
    setSelecionada(null)
    setModalAberto(true)
  }

  function abrirEdicao(profissional: Profissional) {
    setSelecionada(profissional)
    setModalAberto(true)
  }

  async function alternarAtivo(profissional: Profissional) {
    const novoValor = !profissional.ativo
    setProfissionais((atual) =>
      atual.map((p) => (p.id === profissional.id ? { ...p, ativo: novoValor } : p)),
    )

    const { error } = await supabase
      .from('profissionais')
      .update({ ativo: novoValor })
      .eq('id', profissional.id)

    if (error) {
      setProfissionais((atual) =>
        atual.map((p) => (p.id === profissional.id ? { ...p, ativo: profissional.ativo } : p)),
      )
      alert('Não foi possível atualizar o status: ' + error.message)
      return
    }

    await registrarLog({
      usuarioId: user?.id,
      acao: novoValor ? 'ativar_profissional' : 'desativar_profissional',
      tabela: 'profissionais',
      idRegistro: profissional.id,
      dadosAnteriores: { ativo: profissional.ativo },
      dadosNovos: { ativo: novoValor },
    })
  }

  async function excluir(profissional: Profissional) {
    const [{ count: totalAgendamentos }, { count: totalComandas }] = await Promise.all([
      supabase
        .from('agendamentos')
        .select('id', { count: 'exact', head: true })
        .eq('id_profissional', profissional.id),
      supabase
        .from('comandas')
        .select('id', { count: 'exact', head: true })
        .eq('id_profissional', profissional.id),
    ])

    if ((totalAgendamentos ?? 0) > 0 || (totalComandas ?? 0) > 0) {
      alert(
        `${profissional.nome} possui agendamentos ou comandas vinculados e não pode ser excluída. ` +
          'Em vez de excluir, desative o registro para mantê-la fora das novas opções de agendamento sem perder o histórico.',
      )
      return
    }

    const confirmado = await confirmarExclusao({
      titulo: 'Excluir profissional',
      descricao: `Tem certeza que deseja excluir ${profissional.nome}? Essa ação não pode ser desfeita.`,
    })
    if (!confirmado) return

    const { error } = await supabase.from('profissionais').delete().eq('id', profissional.id)

    if (error) {
      alert('Não foi possível excluir: ' + error.message)
      return
    }

    await registrarLog({
      usuarioId: user?.id,
      acao: 'excluir_profissional',
      tabela: 'profissionais',
      idRegistro: profissional.id,
      dadosAnteriores: profissional,
    })

    carregar()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <Button onClick={abrirCriacao} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova profissional
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {carregando && (
            <p className="p-8 text-center text-sm text-muted-foreground">Carregando profissionais...</p>
          )}

          {!carregando && profissionais.length === 0 && (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <UserCog className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium text-foreground">Nenhuma profissional cadastrada ainda</p>
              <p className="text-sm text-muted-foreground">
                Cadastre a primeira profissional para começar a montar a agenda.
              </p>
            </div>
          )}

          {!carregando && profissionais.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Nome</th>
                    <th className="px-5 py-3 font-medium">Horário de almoço</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {profissionais.map((profissional) => (
                    <tr
                      key={profissional.id}
                      className="border-b border-border/60 last:border-0 hover:bg-muted/60"
                    >
                      <td
                        className="cursor-pointer px-5 py-3 font-medium text-foreground"
                        onClick={() => abrirEdicao(profissional)}
                      >
                        {profissional.nome}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {profissional.horario_almoco_inicio && profissional.horario_almoco_fim
                          ? `${profissional.horario_almoco_inicio.slice(0, 5)} às ${profissional.horario_almoco_fim.slice(0, 5)}`
                          : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <button onClick={() => alternarAtivo(profissional)}>
                          <Badge variant={profissional.ativo ? 'accent' : 'outline'}>
                            {profissional.ativo ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </button>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => abrirEdicao(profissional)}>
                            Editar
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => excluir(profissional)}>
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

      <ProfissionalModal
        profissional={selecionada}
        aberto={modalAberto}
        onOpenChange={setModalAberto}
        onSalvo={carregar}
      />
    </div>
  )
}
