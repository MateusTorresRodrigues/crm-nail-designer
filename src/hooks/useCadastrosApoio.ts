import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Produto, Profissional, Servico } from '@/types/database'

export function useCadastrosApoio() {
  const [profissionais, setProfissionais] = useState<Profissional[]>([])
  const [servicos, setServicos] = useState<Servico[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    const [respProfissionais, respServicos, respProdutos] = await Promise.all([
      supabase.from('profissionais').select('*').eq('ativo', true).order('nome'),
      supabase.from('servicos').select('*').eq('ativo', true).order('nome'),
      supabase.from('produtos').select('*').eq('ativo', true).order('nome'),
    ])

    setProfissionais(respProfissionais.data ?? [])
    setServicos(respServicos.data ?? [])
    setProdutos(respProdutos.data ?? [])
    setCarregando(false)
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  return { profissionais, servicos, produtos, carregando, recarregar: carregar }
}
