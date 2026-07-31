import { NavLink } from 'react-router-dom'
import { Home, Utensils, Dumbbell, MessageCircle, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

// Le 5 azioni più frequenti. L'allenamento sta qui e non nell'hamburger:
// si logga in palestra col telefono in una mano.
const items = [
  { to: '/', icon: Home, label: 'Oggi', disabled: false },
  { to: '/meals', icon: Utensils, label: 'Pasti', disabled: false },
  { to: '/allenamento', icon: Dumbbell, label: 'Allena', disabled: false },
  { to: '/chat', icon: MessageCircle, label: 'Chat', disabled: false },
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
