import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { Configuracao } from '@/types/database'

const CONFIGURACAO_PADRAO: Pick<Configuracao, 'nome_negocio' | 'fuso_horario' | 'dias_inatividade'> = {
  nome_negocio: 'Clínica de Nail Designer',
  fuso_horario: 'America/Sao_Paulo',
  dias_inatividade: 30,
}

interface ConfiguracaoContextValue {
  configuracao: Configuracao | null
  carregando: boolean
  nomeNegocio: string
  logoUrl: string | null
}

const ConfiguracaoContext = createContext<ConfiguracaoContextValue | undefined>(undefined)

export function ConfiguracaoProvider({ children }: { children: ReactNode }) {
  const [configuracao, setConfiguracao] = useState<Configuracao | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true

    async function carregarConfiguracao() {
      const { data } = await supabase.from('configuracoes').select('*').limit(1).maybeSingle()
      if (ativo) {
        setConfiguracao(data)
        setCarregando(false)
      }
    }

    carregarConfiguracao()

    const canal = supabase
      .channel('configuracoes-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'configuracoes' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setConfiguracao(null)
          } else {
            setConfiguracao(payload.new as Configuracao)
          }
        },
      )
      .subscribe()

    return () => {
      ativo = false
      supabase.removeChannel(canal)
    }
  }, [])

  const nomeNegocio = configuracao?.nome_negocio ?? CONFIGURACAO_PADRAO.nome_negocio
  const logoUrl = configuracao?.logo_url ?? null

  return (
    <ConfiguracaoContext.Provider value={{ configuracao, carregando, nomeNegocio, logoUrl }}>
      {children}
    </ConfiguracaoContext.Provider>
  )
}

export function useConfiguracao() {
  const context = useContext(ConfiguracaoContext)
  if (!context) {
    throw new Error('useConfiguracao deve ser usado dentro de um ConfiguracaoProvider')
  }
  return context
}
