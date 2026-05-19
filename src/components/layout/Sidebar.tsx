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
        "flex flex-col h-full transition-all duration-300 ease-out relative z-50 bg-[#0F172A] dark:bg-[#0b1222] border-r border-slate-200/10 dark:border-white/5",
        isCollapsed ? "w-20" : "w-64",
        "fixed lg:relative inset-y-0 left-0",
        isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <Button
          variant="secondary"
          size="icon"
          onClick={onToggle}
          className={cn(
            "hidden lg:flex absolute -right-3 top-20 h-8 w-8 rounded-sm bg-[#0F172A] dark:bg-[#0b1222] border border-white/10 text-slate-300 hover:bg-emerald-600 hover:border-emerald-500 hover:text-white transition-all duration-200 z-50"
          )}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onMobileClose}
          className="lg:hidden absolute right-4 top-4 text-slate-400 hover:bg-white/10 hover:text-white z-50"
        >
          <X className="h-6 w-6" />
        </Button>

        <div className={cn(
          "flex h-20 items-center shrink-0 transition-all duration-300",
          isCollapsed ? "justify-center px-4" : "px-6"
        )}>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-2.5 rounded-xl">
                <Stethoscope className="h-6 w-6 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-[4px] border-2 border-[#0F172A] dark:border-[#0B1222]">
                <div className="absolute inset-0.5 bg-emerald-400 rounded-[4px]" />
              </div>
            </div>
            {!isCollapsed && (
              <div className="flex flex-col leading-none animate-in fade-in slide-in-from-left-2 duration-300">
                <span className="text-xl font-black text-white">Para<span className="text-emerald-400">Gestion</span></span>
                <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-widest mt-1">{t('app.tagline')}</span>
              </div>
            )}
          </div>
        </div>

        <div className="relative flex-1 flex flex-col min-h-0">
          <div className={cn(
            "absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-[#0F172A] dark:from-[#0B1222] to-transparent z-10 pointer-events-none transition-opacity",
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
                    <div className="px-3 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
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
                              ? 'bg-white/10 text-white' 
                              : 'text-slate-400 hover:bg-white/5 hover:text-white',
                            'relative group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all',
                            isCollapsed ? "justify-center" : ""
                          )}
                        >
                          {isActive && !isCollapsed && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-emerald-500" />
                          )}
                          <item.icon
                            className={cn(
                              isActive ? 'text-white opacity-100 drop-shadow-[0_0_8px_rgba(255,255,255,0.15)]' : 'text-slate-400 opacity-70 group-hover:text-white group-hover:opacity-100',
                              isCollapsed ? "h-5 w-5" : "mr-3 h-4 w-4",
                              'flex-shrink-0 transition-all duration-200'
                            )}
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
            "absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#0F172A] dark:from-[#0B1222] to-transparent z-10 pointer-events-none transition-opacity",
            showBottomShadow ? "opacity-100" : "opacity-0"
          )} />
        </div>

        <div className="p-4 shrink-0">
          <div className={cn(
            "flex items-center",
            isCollapsed ? "justify-center" : "gap-3"
          )}>
            <Avatar className="h-10 w-10 border-2 border-slate-700">
              <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} />
              <AvatarFallback className="bg-slate-800 text-slate-300 font-bold">
                {user?.email?.charAt(0)?.toUpperCase() || 'P'}
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">
                  {user?.email?.split('@')[0]}
                </p>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  {t('header.administrator')}
                </p>
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            onClick={handleSignOut}
            className={cn(
              "w-full mt-3 text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 font-semibold rounded-[4px]",
              isCollapsed ? "px-0 justify-center" : "px-3"
            )}
          >
            <LogOut className={cn("h-5 w-5", !isCollapsed && "mr-3")} />
            {!isCollapsed && <span className="font-medium">{t('header.logout')}</span>}
          </Button>
        </div>
      </div>
    </>
  );
}
