import { useEffect, useState } from 'react'
import { Loader2, Search, UserPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useDebounce } from '@/hooks/useDebounce'
import type { Contato } from '@/types/database'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

interface ClienteBuscaCampoProps {
  clienteSelecionado: Contato | null
  onSelecionar: (cliente: Contato | null) => void
}

export default function ClienteBuscaCampo({ clienteSelecionado, onSelecionar }: ClienteBuscaCampoProps) {
  const [busca, setBusca] = useState('')
  const buscaDebounced = useDebounce(busca, 300)
  const [resultados, setResultados] = useState<Contato[]>([])
  const [buscando, setBuscando] = useState(false)
  const [mostrarCriacao, setMostrarCriacao] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoWhatsapp, setNovoWhatsapp] = useState('')
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!buscaDebounced.trim() || clienteSelecionado) {
      setResultados([])
      return
    }

    let ativo = true
    setBuscando(true)

    supabase
      .from('crm_naildesigner')
      .select('*')
      .or(`nome.ilike.%${buscaDebounced}%,whatsapp.ilike.%${buscaDebounced}%`)
      .limit(8)
      .then(({ data }) => {
        if (!ativo) return
        setResultados(data ?? [])
        setBuscando(false)
      })

    return () => {
      ativo = false
    }
  }, [buscaDebounced, clienteSelecionado])

  async function criarCliente() {
    if (!novoWhatsapp.trim()) {
      setErro('Informe o WhatsApp do novo cliente.')
      return
    }

    setCriando(true)
    setErro(null)

    const { data, error } = await supabase
      .from('crm_naildesigner')
      .insert({ whatsapp: novoWhatsapp.trim(), nome: novoNome.trim() || null })
      .select()
      .single()

    setCriando(false)

    if (error || !data) {
      setErro(
        error?.code === '23505'
          ? 'Já existe um contato cadastrado com esse WhatsApp.'
          : 'Não foi possível cadastrar: ' + error?.message,
      )
      return
    }

    onSelecionar(data as Contato)
    setMostrarCriacao(false)
    setNovoNome('')
    setNovoWhatsapp('')
  }

  if (clienteSelecionado) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-border bg-background px-3.5 py-2.5">
        <div>
          <p className="text-sm font-medium text-foreground">
            {clienteSelecionado.nome || clienteSelecionado.whatsapp}
          </p>
          <p className="text-xs text-muted-foreground">{clienteSelecionado.whatsapp}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onSelecionar(null)}>
          Trocar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nome ou WhatsApp"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {buscando && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {resultados.length > 0 && (
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border bg-background p-1.5">
          {resultados.map((cliente) => (
            <li key={cliente.id}>
              <button
                type="button"
                onClick={() => {
                  onSelecionar(cliente)
                  setBusca('')
                }}
                className="flex w-full flex-col rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted"
              >
                <span className="font-medium text-foreground">{cliente.nome || cliente.whatsapp}</span>
                <span className="text-xs text-muted-foreground">
                  {cliente.whatsapp} · {cliente.tipo === 'cliente' ? 'Cliente' : 'Lead'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {buscaDebounced.trim() && !buscando && resultados.length === 0 && !mostrarCriacao && (
        <button
          type="button"
          onClick={() => {
            setMostrarCriacao(true)
            setNovoWhatsapp(busca)
          }}
          className="flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary"
        >
          <UserPlus className="h-4 w-4" />
          Nenhum contato encontrado. Cadastrar novo cliente?
        </button>
      )}

      {mostrarCriacao && (
        <div className="space-y-2 rounded-xl border border-border bg-muted/50 p-3">
          <div className="space-y-1.5">
            <Label htmlFor="novo-cliente-whatsapp">WhatsApp *</Label>
            <Input
              id="novo-cliente-whatsapp"
              value={novoWhatsapp}
              onChange={(e) => setNovoWhatsapp(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="novo-cliente-nome">Nome</Label>
            <Input id="novo-cliente-nome" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} />
          </div>
          {erro && <p className="text-xs text-destructive">{erro}</p>}
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={criarCliente} disabled={criando}>
              {criando ? 'Cadastrando...' : 'Cadastrar e selecionar'}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setMostrarCriacao(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
