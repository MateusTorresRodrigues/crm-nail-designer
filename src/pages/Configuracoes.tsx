import { useEffect, useRef, useState } from 'react'
import { Image as ImageIcon, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { registrarLog } from '@/lib/logs'
import { FUSOS_HORARIOS_BRASIL } from '@/lib/fusos-horarios'
import { useAuth } from '@/contexts/AuthContext'
import { useConfiguracao } from '@/contexts/ConfiguracaoContext'
import type { Disponibilidade } from '@/types/database'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import DisponibilidadeGrid from '@/components/profissionais/DisponibilidadeGrid'
import AbaApi from '@/components/configuracoes/AbaApi'
import { cn } from '@/lib/utils'

const TIPOS_ACEITOS = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
const ABA_GERAL = 'geral'
const ABA_API = 'api'

export default function Configuracoes() {
  const { user } = useAuth()
  const { configuracao, carregando } = useConfiguracao()
  const inputArquivoRef = useRef<HTMLInputElement>(null)
  const [aba, setAba] = useState<typeof ABA_GERAL | typeof ABA_API>(ABA_GERAL)

  const [nomeNegocio, setNomeNegocio] = useState('')
  const [fusoHorario, setFusoHorario] = useState('America/Sao_Paulo')
  const [diasInatividade, setDiasInatividade] = useState('30')
  const [horarioFuncionamento, setHorarioFuncionamento] = useState<Disponibilidade>({})
  const [percentualSinal, setPercentualSinal] = useState('50')

  const [salvando, setSalvando] = useState(false)
  const [enviandoLogo, setEnviandoLogo] = useState(false)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!configuracao) return
    setNomeNegocio(configuracao.nome_negocio)
    setFusoHorario(configuracao.fuso_horario)
    setDiasInatividade(String(configuracao.dias_inatividade))
    setHorarioFuncionamento(configuracao.horario_funcionamento ?? {})
    setPercentualSinal(String(configuracao.percentual_sinal))
  }, [configuracao])

  async function salvar() {
    if (!configuracao) return

    const diasNum = Number(diasInatividade)
    const percentualNum = Number(percentualSinal)
    if (!nomeNegocio.trim()) {
      setErro('Informe o nome da clínica.')
      return
    }
    if (!Number.isInteger(diasNum) || diasNum <= 0) {
      setErro('Informe um prazo de retorno válido (em dias).')
      return
    }
    if (!Number.isFinite(percentualNum) || percentualNum <= 0 || percentualNum > 100) {
      setErro('Informe um percentual de sinal válido (entre 1 e 100).')
      return
    }

    setSalvando(true)
    setErro(null)
    setMensagem(null)

    const dadosNovos = {
      nome_negocio: nomeNegocio.trim(),
      fuso_horario: fusoHorario,
      dias_inatividade: diasNum,
      horario_funcionamento: horarioFuncionamento,
      percentual_sinal: percentualNum,
    }

    const { error } = await supabase.from('configuracoes').update(dadosNovos).eq('id', configuracao.id)

    setSalvando(false)

    if (error) {
      setErro('Não foi possível salvar: ' + error.message)
      return
    }

    await registrarLog({
      usuarioId: user?.id,
      acao: 'atualizar_configuracoes',
      tabela: 'configuracoes',
      idRegistro: configuracao.id,
      dadosAnteriores: {
        nome_negocio: configuracao.nome_negocio,
        fuso_horario: configuracao.fuso_horario,
        dias_inatividade: configuracao.dias_inatividade,
        horario_funcionamento: configuracao.horario_funcionamento,
        percentual_sinal: configuracao.percentual_sinal,
      },
      dadosNovos,
    })

    setMensagem('Alterações salvas com sucesso.')
  }

  async function enviarLogo(arquivo: File) {
    if (!configuracao) return

    if (!TIPOS_ACEITOS.includes(arquivo.type)) {
      setErro('Formato de imagem não suportado. Use PNG, JPEG, WEBP ou SVG.')
      return
    }

    setEnviandoLogo(true)
    setErro(null)
    setMensagem(null)

    const extensao = arquivo.name.split('.').pop()
    const nomeArquivo = `logo-${Date.now()}.${extensao}`

    const { error: erroUpload } = await supabase.storage.from('logos').upload(nomeArquivo, arquivo, {
      upsert: true,
    })

    if (erroUpload) {
      setEnviandoLogo(false)
      setErro('Não foi possível enviar a logo: ' + erroUpload.message)
      return
    }

    const { data } = supabase.storage.from('logos').getPublicUrl(nomeArquivo)

    const { error: erroAtualizar } = await supabase
      .from('configuracoes')
      .update({ logo_url: data.publicUrl })
      .eq('id', configuracao.id)

    setEnviandoLogo(false)

    if (erroAtualizar) {
      setErro('Logo enviada, mas não foi possível salvar: ' + erroAtualizar.message)
      return
    }

    await registrarLog({
      usuarioId: user?.id,
      acao: 'atualizar_logo',
      tabela: 'configuracoes',
      idRegistro: configuracao.id,
      dadosAnteriores: { logo_url: configuracao.logo_url },
      dadosNovos: { logo_url: data.publicUrl },
    })

    setMensagem('Logo atualizada com sucesso.')
  }

  if (carregando || !configuracao) {
    return <p className="text-sm text-muted-foreground">Carregando configurações...</p>
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex gap-1 rounded-xl bg-muted p-1">
        <button
          onClick={() => setAba(ABA_GERAL)}
          className={cn(
            'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
            aba === ABA_GERAL ? 'bg-card shadow-card text-foreground' : 'text-muted-foreground',
          )}
        >
          Geral
        </button>
        <button
          onClick={() => setAba(ABA_API)}
          className={cn(
            'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
            aba === ABA_API ? 'bg-card shadow-card text-foreground' : 'text-muted-foreground',
          )}
        >
          API
        </button>
      </div>

      {aba === ABA_API && <AbaApi />}

      {aba === ABA_GERAL && (
        <>
      <Card>
        <CardHeader>
          <CardTitle>Dados gerais</CardTitle>
          <CardDescription>Nome, logo e fuso horário da clínica.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
              {configuracao.logo_url ? (
                <img src={configuracao.logo_url} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-1.5">
              <input
                ref={inputArquivoRef}
                type="file"
                accept={TIPOS_ACEITOS.join(',')}
                className="hidden"
                onChange={(e) => {
                  const arquivo = e.target.files?.[0]
                  if (arquivo) enviarLogo(arquivo)
                  e.target.value = ''
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => inputArquivoRef.current?.click()}
                disabled={enviandoLogo}
              >
                {enviandoLogo ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Enviando...
                  </>
                ) : (
                  'Alterar logo'
                )}
              </Button>
              <p className="text-xs text-muted-foreground">PNG, JPEG, WEBP ou SVG.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nome-negocio">Nome da clínica</Label>
            <Input id="nome-negocio" value={nomeNegocio} onChange={(e) => setNomeNegocio(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Fuso horário</Label>
            <Select value={fusoHorario} onValueChange={setFusoHorario}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FUSOS_HORARIOS_BRASIL.map((f) => (
                  <SelectItem key={f.valor} value={f.valor}>
                    {f.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Horário de funcionamento</CardTitle>
          <CardDescription>Dias e horários em que a clínica abre para atendimento.</CardDescription>
        </CardHeader>
        <CardContent>
          <DisponibilidadeGrid
            value={horarioFuncionamento}
            onChange={setHorarioFuncionamento}
            rotuloInativo="Fechado"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prazo de retorno</CardTitle>
          <CardDescription>
            Prazo padrão, em dias, usado na página de Retorno quando o serviço realizado não tiver um
            prazo próprio cadastrado (em Serviços).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs space-y-2">
            <Label htmlFor="dias-inatividade">Dias para retorno (padrão)</Label>
            <Input
              id="dias-inatividade"
              type="number"
              min={1}
              value={diasInatividade}
              onChange={(e) => setDiasInatividade(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pagamentos</CardTitle>
          <CardDescription>
            Percentual do valor do serviço cobrado como sinal ao criar um agendamento, via Asaas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs space-y-2">
            <Label htmlFor="percentual-sinal">Percentual do sinal (%)</Label>
            <Input
              id="percentual-sinal"
              type="number"
              min={1}
              max={100}
              value={percentualSinal}
              onChange={(e) => setPercentualSinal(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {erro && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
      {mensagem && (
        <p className="rounded-lg bg-accent/15 px-3 py-2 text-sm text-accent">{mensagem}</p>
      )}

      <Button onClick={salvar} disabled={salvando}>
        {salvando ? 'Salvando...' : 'Salvar alterações'}
      </Button>
        </>
      )}
    </div>
  )
}
