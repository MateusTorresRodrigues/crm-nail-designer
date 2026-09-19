import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHROME, corCategorica } from '@/lib/paleta-graficos'
import TooltipGrafico from './TooltipGrafico'

export interface PontoContatosDia {
  data: string
  rotulo: string
  contatos: number
}

interface GraficoLinhaWhatsappProps {
  dados: PontoContatosDia[]
}

export default function GraficoLinhaWhatsapp({ dados }: GraficoLinhaWhatsappProps) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={CHROME.grid} />
        <XAxis
          dataKey="rotulo"
          tick={{ fill: CHROME.textoMudo, fontSize: 12 }}
          axisLine={{ stroke: CHROME.eixo }}
          tickLine={false}
          minTickGap={20}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: CHROME.textoMudo, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={28}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            return (
              <TooltipGrafico
                titulo={label}
                itens={[{ rotulo: 'Novos contatos', valor: String(payload[0]?.value ?? 0), cor: corCategorica(0) }]}
              />
            )
          }}
        />
        <Line
          type="monotone"
          dataKey="contatos"
          stroke={corCategorica(0)}
          strokeWidth={2}
          dot={{ r: 3, fill: corCategorica(0), strokeWidth: 0 }}
          activeDot={{ r: 5, fill: corCategorica(0), stroke: '#fcfcfb', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
