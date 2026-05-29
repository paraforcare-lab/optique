import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { 
  Sparkles, Stethoscope, LayoutDashboard, FileText, ShoppingCart, Package, 
  Users, Building2, Settings, Database, ChevronLeft, ChevronRight, LogOut,
  X, Receipt, ClipboardList, Truck, DollarSign, FileCheck, Eye, Glasses,
  FlaskConical, CalendarDays
} from 'lucide-react';
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useTranslation } from 'react-i18next'

const navigationGroups = [
  {
    id: 'general',
    titleKey: 'navigation.dashboard',
    items: [
      { nameKey: 'navigation.workspace', href: '/', icon: Sparkles },
      { nameKey: 'navigation.dashboard', href: '/dashboard', icon: LayoutDashboard },
    ]
  },
  {
    id: 'optique',
    titleKey: 'nav.optique',
    items: [
      { nameKey: 'navigation.prescriptions', href: '/prescriptions', icon: Eye },
      { nameKey: 'navigation.appointments', href: '/rendez-vous', icon: CalendarDays },
      { nameKey: 'navigation.products', href: '/produits', icon: Glasses },
    ]
  },
  {
    id: 'vente',
    titleKey: 'nav.ventes',
    items: [
      { nameKey: 'navigation.invoices', href: '/factures', icon: FileText },
      { nameKey: 'navigation.quotes', href: '/devis', icon: FileCheck },
      { nameKey: 'navigation.counter_sales', href: '/ventes-passagers', icon: ShoppingCart },
      { nameKey: 'navigation.credit_notes', href: '/avoirs', icon: Receipt },
      { nameKey: 'navigation.delivery_notes', href: '/bons-livraison', icon: Truck },
    ]
  },
  {
    id: 'achat',
    titleKey: 'nav.achats',
    items: [
      { nameKey: 'navigation.purchase_orders', href: '/bons-commande', icon: ClipboardList },
      { nameKey: 'navigation.expenses', href: '/depenses', icon: DollarSign },
    ]
  },
  {
    id: 'contacts',
    titleKey: 'nav.contacts',
    items: [
      { nameKey: 'navigation.clients', href: '/clients', icon: Users },
      { nameKey: 'navigation.suppliers', href: '/fournisseurs', icon: Building2 },
    ]
  },
  {
    id: 'systeme',
    titleKey: 'nav.systeme',
    items: [
      { nameKey: 'navigation.settings', href: '/parametres', icon: Settings },
      { nameKey: 'navigation.import_export', href: '/import-export', icon: Database },
    ]
  }
];

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ isCollapsed, onToggle, isMobileOpen, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showTopShadow, setShowTopShadow] = useState(false);
  const [showBottomShadow, setShowBottomShadow] = useState(false);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      setShowTopShadow(scrollTop > 0);
      setShowBottomShadow(scrollTop + clientHeight < scrollHeight - 5);
    }
  };

  useEffect(() => {
    handleScroll();
    window.addEventListener('resize', handleScroll);
    return () => window.removeEventListener('resize', handleScroll);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <>
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={onMobileClose}
        />
      )}

      <div className={cn(
        "flex flex-col h-screen transition-all duration-300 ease-out z-[65]",
        "bg-[#FBFBFE] dark:bg-[#0b1222] border-r border-[#EAEAF4] dark:border-white/5",
        isCollapsed ? "w-20" : "w-64",
        // Always `fixed` and out of flow. The main content wrapper reserves the
        // matching width via lg:ps-20 / lg:ps-64, so they never overlap.
        "fixed inset-y-0 left-0",
        isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <Button
          variant="secondary"
          size="icon"
          onClick={onToggle}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            "hidden lg:flex absolute -right-3.5 top-7 h-7 w-7 rounded-full z-[70] transition-all duration-200",
            "bg-white dark:bg-[#0b1222] border border-[#EAEAF4] dark:border-white/10 text-slate-500 dark:text-slate-300 shadow-md",
            "hover:bg-[#6D5BF6] hover:border-[#6D5BF6] hover:text-white"
          )}
        >
          {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onMobileClose}
          className="lg:hidden absolute right-4 top-4 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-white z-50"
        >
          <X className="h-6 w-6" />
        </Button>

        <div className={cn(
          "flex h-20 items-center shrink-0 transition-all duration-300",
          isCollapsed ? "justify-center px-4" : "px-6"
        )}>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="bg-gradient-to-br from-[#7C6BF8] to-[#5B49E8] p-2.5 rounded-2xl shadow-[0_6px_16px_-6px_rgba(109,91,246,0.55)]">
                <Eye className="h-6 w-6 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#6D5BF6] rounded-[5px] border-2 border-[#FBFBFE] dark:border-[#0B1222]">
                <div className="absolute inset-0.5 bg-[#A78BFA] rounded-[4px]" />
              </div>
            </div>
            {!isCollapsed && (
              <div className="flex flex-col leading-none animate-in fade-in slide-in-from-left-2 duration-300">
                <span className="text-xl font-black text-[#1E1B33] dark:text-white tracking-tight">Opti<span className="text-[#6D5BF6]">Gestion</span></span>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-widest mt-1">{t('app.tagline')}</span>
              </div>
            )}
          </div>
        </div>

        <div className="relative flex-1 flex flex-col min-h-0">
          <div className={cn(
            "absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-[#FBFBFE] dark:from-[#0B1222] to-transparent z-10 pointer-events-none transition-opacity",
            showTopShadow ? "opacity-100" : "opacity-0"
          )} />

          <div 
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto py-4 px-3 sidebar-scroll"
          >
            <nav className="space-y-5">
              {navigationGroups.map((group) => (
                <div key={group.id} className="space-y-1">
                  {!isCollapsed && (
                    <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.12em]">
                      {t(group.titleKey)}
                    </div>
                  )}
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const isActive = location.pathname === item.href || 
                                      (item.href !== '/' && location.pathname.startsWith(item.href));
                      return (
                        <Link
                          key={item.nameKey}
                          to={item.href}
                          onClick={onMobileClose}
                          title={isCollapsed ? t(item.nameKey) : undefined}
                          className={cn(
                            isActive
                              ? 'nav-pill-active'
                              : 'text-slate-500 dark:text-slate-400 hover:bg-[#F2F2FA] dark:hover:bg-white/5 hover:text-[#1E1B33] dark:hover:text-white',
                            'relative group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                            isCollapsed ? "justify-center" : ""
                          )}
                        >
                          {isActive && !isCollapsed && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[#6D5BF6]" />
                          )}
                          <item.icon
                            className={cn(
                              isActive
                                ? 'text-[#4A3FCF] dark:text-[#C7C0FF] opacity-100'
                                : 'text-slate-400 dark:text-slate-400 opacity-80 group-hover:text-[#6D5BF6] dark:group-hover:text-white group-hover:opacity-100',
                              isCollapsed ? "h-5 w-5" : "mr-3 h-[18px] w-[18px]",
                              'flex-shrink-0 transition-all duration-200'
                            )}
                            strokeWidth={isActive ? 2.25 : 1.9}
                          />
                          {!isCollapsed && <span className="truncate">{t(item.nameKey)}</span>}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>

          <div className={cn(
            "absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#FBFBFE] dark:from-[#0B1222] to-transparent z-10 pointer-events-none transition-opacity",
            showBottomShadow ? "opacity-100" : "opacity-0"
          )} />
        </div>

        <div className="p-3 shrink-0 border-t border-[#EAEAF4] dark:border-white/5">
          <div className={cn(
            "rounded-2xl bg-white dark:bg-white/5 border border-[#EAEAF4] dark:border-white/5 p-2.5",
            isCollapsed ? "px-0 border-transparent bg-transparent dark:bg-transparent" : ""
          )}>
            <div className={cn(
              "flex items-center",
              isCollapsed ? "justify-center" : "gap-3"
            )}>
              <Avatar className="h-10 w-10 ring-2 ring-[#EEEDFB] dark:ring-white/10">
                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} />
                <AvatarFallback className="bg-[#EEEDFB] dark:bg-slate-800 text-[#4A3FCF] dark:text-slate-300 font-bold">
                  {user?.email?.charAt(0)?.toUpperCase() || 'P'}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#1E1B33] dark:text-white truncate">
                    {user?.email?.split('@')[0]}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-400 font-semibold uppercase tracking-wider">
                    {t('header.administrator')}
                  </p>
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              onClick={handleSignOut}
              className={cn(
                "w-full mt-2 text-slate-500 dark:text-slate-400 hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 transition-all duration-200 font-semibold rounded-xl",
                isCollapsed ? "px-0 justify-center" : "px-3 justify-start"
              )}
            >
              <LogOut className={cn("h-[18px] w-[18px]", !isCollapsed && "mr-3")} strokeWidth={1.9} />
              {!isCollapsed && <span className="font-medium">{t('header.logout')}</span>}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
