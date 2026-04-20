import { NavLink } from 'react-router-dom'
import { Home, Utensils, Dumbbell, MessageCircle, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const items = [
  { to: '/', icon: Home, label: 'Oggi', disabled: false },
  { to: '/meals', icon: Utensils, label: 'Pasti', disabled: true },
  { to: '/training', icon: Dumbbell, label: 'Training', disabled: true },
  { to: '/chat', icon: MessageCircle, label: 'Chat', disabled: true },
  { to: '/settings', icon: Settings, label: 'Impost.', disabled: false },
]

export function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 py-3 text-[10px] uppercase tracking-wider transition-colors',
                  item.disabled && 'pointer-events-none opacity-40',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
