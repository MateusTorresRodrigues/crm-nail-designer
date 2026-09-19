import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { corCategorica, CHROME } from '@/lib/paleta-graficos'
import { formatarValor } from '@/lib/date'
import TooltipGrafico from './TooltipGrafico'

export interface PontoServico {
  nome: string
  quantidade: number
  valorTotal: number
}

interface GraficoServicosMaisVendidosProps {
  dados: PontoServico[]
}

export default function GraficoServicosMaisVendidos({ dados }: GraficoServicosMaisVendidosProps) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, dados.length * 44)}>
      <BarChart data={dados} layout="vertical" margin={{ left: 8, right: 24 }}>
        <CartesianGrid horizontal={false} stroke={CHROME.grid} />
        <XAxis
          type="number"
          allowDecimals={false}
          tick={{ fill: CHROME.textoMudo, fontSize: 12 }}
          axisLine={{ stroke: CHROME.eixo }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="nome"
          tick={{ fill: CHROME.textoSecundario, fontSize: 13 }}
          axisLine={false}
          tickLine={false}
          width={140}
        />
        <Tooltip
          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const ponto = payload[0]?.payload as PontoServico | undefined
            if (!ponto) return null
            return (
              <TooltipGrafico
                titulo={ponto.nome}
                itens={[
                  { rotulo: 'Quantidade vendida', valor: String(ponto.quantidade) },
                  { rotulo: 'Valor gerado', valor: formatarValor(ponto.valorTotal) },
                ]}
              />
            )
          }}
        />
        <Bar dataKey="quantidade" radius={[0, 4, 4, 0]} maxBarSize={24}>
          {dados.map((entrada, indice) => (
            <Cell key={entrada.nome} fill={corCategorica(indice)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
