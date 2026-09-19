import {
  LayoutDashboard,
  CalendarDays,
  Users,
  UserPlus,
  UserCog,
  Sparkles,
  Package,
  ClipboardList,
  RotateCcw,
  CreditCard,
  Settings,
  FileText,
  type LucideIcon,
} from 'lucide-react'

export interface ItemMenu {
  rotulo: string
  caminho: string
  icone: LucideIcon
}

export const itensMenu: ItemMenu[] = [
  { rotulo: 'Dashboard', caminho: '/', icone: LayoutDashboard },
  { rotulo: 'Agenda', caminho: '/agenda', icone: CalendarDays },
  { rotulo: 'Clientes', caminho: '/clientes', icone: Users },
  { rotulo: 'Leads', caminho: '/leads', icone: UserPlus },
  { rotulo: 'Profissionais', caminho: '/profissionais', icone: UserCog },
  { rotulo: 'Serviços', caminho: '/servicos', icone: Sparkles },
  { rotulo: 'Produtos', caminho: '/produtos', icone: Package },
  { rotulo: 'Comandas', caminho: '/comandas', icone: ClipboardList },
  { rotulo: 'Retorno', caminho: '/retorno', icone: RotateCcw },
  { rotulo: 'Pagamentos', caminho: '/pagamentos', icone: CreditCard },
  { rotulo: 'Configurações', caminho: '/configuracoes', icone: Settings },
  { rotulo: 'Logs', caminho: '/logs', icone: FileText },
]
