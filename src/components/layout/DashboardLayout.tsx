import { useState, useEffect, useRef, useCallback } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { NotificationBell } from './NotificationDropdown'
import { LanguageSelector } from './LanguageSelector'
import { Menu, ChevronDown, Settings, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/contexts/NotificationsContext'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

const routeMeta: Record<string, { titleKey: string; subtitleKey: string }> = {
  '/':                { titleKey: 'navigation.workspace',      subtitleKey: 'header.subtitles.workspace'      },
  '/dashboard':       { titleKey: 'navigation.dashboard',      subtitleKey: 'header.subtitles.dashboard'      },
  '/factures':        { titleKey: 'navigation.invoices',       subtitleKey: 'header.subtitles.invoices'       },
  '/devis':           { titleKey: 'navigation.quotes',         subtitleKey: 'header.subtitles.quotes'         },
  '/ventes-passagers':{ titleKey: 'navigation.counter_sales',  subtitleKey: 'header.subtitles.counter_sales'  },
  '/avoirs':          { titleKey: 'navigation.credit_notes',   subtitleKey: 'header.subtitles.credit_notes'   },
  '/bons-livraison':  { titleKey: 'navigation.delivery_notes', subtitleKey: 'header.subtitles.delivery_notes' },
  '/bons-commande':   { titleKey: 'navigation.purchase_orders',subtitleKey: 'header.subtitles.purchase_orders'},
  '/depenses':        { titleKey: 'navigation.expenses',       subtitleKey: 'header.subtitles.expenses'       },
  '/clients':         { titleKey: 'navigation.clients',        subtitleKey: 'header.subtitles.clients'        },
  '/fournisseurs':    { titleKey: 'navigation.suppliers',      subtitleKey: 'header.subtitles.suppliers'      },
  '/produits':        { titleKey: 'navigation.products',       subtitleKey: 'header.subtitles.products'       },
  '/parametres':      { titleKey: 'navigation.settings',       subtitleKey: 'header.subtitles.settings'       },
  '/import-export':   { titleKey: 'navigation.import_export',  subtitleKey: 'header.subtitles.import_export'  },
  '/transactions':    { titleKey: 'navigation.transactions',   subtitleKey: 'header.subtitles.transactions'   },
};

export function DashboardLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { t, i18n } = useTranslation();

  const currentRoute = routeMeta[location.pathname] || { titleKey: 'app.name', subtitleKey: '' };
  const routeTitle = t(currentRoute.titleKey);
  const subtitle = currentRoute.subtitleKey ? t(currentRoute.subtitleKey) : '';

  const userInitial = user?.email?.charAt(0)?.toUpperCase() || 'P';
  const displayName = user?.email?.split('@')[0] || 'OptiGestion';
  const { unreadCount, notifications } = useNotifications();

  const currentLang = i18n.language?.startsWith('ar') ? 'ar' : i18n.language?.startsWith('en') ? 'en' : 'fr';

  const hasHighPriority = notifications.some(n => !n.is_read && (n.type === 'error' || n.type === 'warning'));

  const handleLogout = useCallback(async () => {
    setProfileDropdownOpen(false);
    await signOut();
    navigate('/login');
  }, [signOut, navigate]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    if (profileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileDropdownOpen]);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    if (hasHighPriority && unreadCount > 0) {
      document.title = `Action requise - OptiGestion`;
    } else if (unreadCount > 0) {
      document.title = `(${unreadCount}) OptiGestion`;
    } else {
      document.title = 'OptiGestion';
    }
  }, [hasHighPriority, unreadCount]);

  return (
    <div dir={currentLang === 'ar' ? 'rtl' : 'ltr'} className="flex h-screen overflow-hidden bg-white dark:bg-[#0F172A]">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="lg:hidden fixed top-4 left-4 z-50">
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setIsMobileOpen(true)}
            className="h-10 w-10 rounded-[6px] bg-background/90 backdrop-blur-sm border border-border"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        <header className="bg-white dark:bg-[#0F172A] border-b border-slate-200 dark:border-white/10 px-6 lg:px-8 py-4 shrink-0">
          <div className="flex items-center justify-between gap-6">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-foreground tracking-tight">
                {routeTitle}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {subtitle && <>{subtitle} - </>}
                <span className="text-blue-600 font-medium">{t('header.system_active')}</span>
              </p>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <LanguageSelector />

              <NotificationBell />

              <div className="w-px h-8 bg-border" />

              <div className="relative" ref={profileRef}>
                <div
                  className="flex items-center gap-3 cursor-pointer group"
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                >
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold text-foreground transition-colors">
                      {displayName}
                    </p>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {t('header.administrator')}
                    </p>
                  </div>
                  <Avatar className="h-9 w-9 border-2 border-blue-500/30 group-hover:border-blue-400 transition-colors">
                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} />
                    <AvatarFallback className={cn(
                      "bg-blue-500/10 text-blue-600 font-bold text-sm dark:text-blue-300",
                      "group-hover:bg-blue-500/20 dark:group-hover:bg-blue-500/30 transition-colors"
                    )}>
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                    <ChevronDown className={cn(
                    "h-4 w-4 text-muted-foreground group-hover:text-foreground transition-all duration-200 hidden sm:block",
                    profileDropdownOpen && "rotate-180"
                  )} />
                </div>

                {profileDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 z-50 w-52 bg-popover border border-border rounded-[4px] shadow-lg overflow-hidden">
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-sm font-semibold text-popover-foreground truncate">{displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>

                    <div className="py-1">
                      <button
                        onClick={() => { setProfileDropdownOpen(false); navigate('/parametres'); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-popover-foreground hover:bg-muted transition-colors"
                      >
                        <Settings className="h-4 w-4 text-muted-foreground" />
                        {t('header.settings')}
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        {t('header.logout')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 h-full overflow-y-auto overscroll-none p-4 lg:p-8 bg-white dark:bg-[#0F172A]">
          <div className="max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
