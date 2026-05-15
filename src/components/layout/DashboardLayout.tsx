import { useState, useEffect, useRef, useCallback } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { NotificationBell } from './NotificationDropdown'
import { Menu, ChevronDown, Settings, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/contexts/NotificationsContext'
import { cn } from '@/lib/utils'

const routeMeta: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Espace de Travail', subtitle: 'Bienvenue sur ParaGestion' },
  '/dashboard': { title: 'Tableau de Bord', subtitle: 'Analyse et rapports financiers' },
  '/factures': { title: 'Factures', subtitle: 'Gestion des factures clients' },
  '/devis': { title: 'Devis', subtitle: 'Gestion des devis' },
  '/ventes-passagers': { title: 'Ventes Passagers', subtitle: 'Ventes au comptoir' },
  '/avoirs': { title: 'Avoirs', subtitle: 'Notes de crédit et avoirs' },
  '/bons-livraison': { title: 'Bons de Livraison', subtitle: 'Suivi des livraisons' },
  '/bons-commande': { title: 'Bons de Commande', subtitle: 'Gestion des commandes' },
  '/depenses': { title: 'Dépenses', subtitle: 'Suivi des dépenses' },
  '/clients': { title: 'Clients', subtitle: 'Gestion du portefeuille client' },
  '/fournisseurs': { title: 'Fournisseurs', subtitle: 'Gestion des fournisseurs' },
  '/produits': { title: 'Produits', subtitle: 'Gestion du catalogue' },
  '/parametres': { title: 'Paramètres', subtitle: "Configuration de l'application" },
  '/import-export': { title: 'Import / Export', subtitle: 'Transfert de données' },
  '/transactions': { title: 'Transactions', subtitle: 'Historique des opérations' },
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

  const currentRoute = routeMeta[location.pathname] || { title: 'ParaGestion', subtitle: '' };
  const userInitial = user?.email?.charAt(0)?.toUpperCase() || 'P';
  const displayName = user?.email?.split('@')[0] || 'ParaGestion';
  const { unreadCount, notifications } = useNotifications();

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
      document.title = `Action requise - ParaGestion`;
    } else if (unreadCount > 0) {
      document.title = `(${unreadCount}) ParaGestion`;
    } else {
      document.title = 'ParaGestion';
    }
  }, [hasHighPriority, unreadCount]);

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-[#0F172A]">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile Hamburger */}
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

        {/* Header */}
        <header className="bg-white dark:bg-[#0F172A] border-b border-slate-200 dark:border-white/10 px-6 lg:px-8 py-4 shrink-0">
          <div className="flex items-center justify-between gap-6">
            {/* Left: Title & Status */}
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-foreground tracking-tight">
                {currentRoute.title}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {currentRoute.subtitle && <>{currentRoute.subtitle} - </>}
                <span className="text-emerald-600 font-medium">Système actif</span>
              </p>
            </div>

            {/* Right: Actions & Profile */}
            <div className="flex items-center gap-4 shrink-0">
              {/* Notification Bell */}
              <NotificationBell />

              {/* Vertical Divider */}
              <div className="w-px h-8 bg-border" />

              {/* User Profile Dropdown */}
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
                      ADMINISTRATEUR
                    </p>
                  </div>
                  <Avatar className="h-9 w-9 border-2 border-emerald-500/30 group-hover:border-emerald-400 transition-colors">
                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} />
                    <AvatarFallback className={cn(
                      "bg-emerald-500/10 text-emerald-600 font-bold text-sm dark:text-emerald-300",
                      "group-hover:bg-emerald-500/20 dark:group-hover:bg-emerald-500/30 transition-colors"
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
                    {/* User info header */}
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
                        Paramètres
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        Déconnexion
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 h-full overflow-y-auto overscroll-none p-4 lg:p-8 bg-white dark:bg-[#0F172A]">
          <div className="max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
