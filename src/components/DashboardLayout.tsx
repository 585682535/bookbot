import React, { useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Calendar, 
  ListTodo, 
  Scissors, 
  Users, 
  Settings, 
  LogOut,
  ChevronLeft,
  Ticket,
  MessageSquare,
  Sparkles,
  Menu,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { slug } = useParams();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menuItems = [
    { icon: LayoutDashboard, label: 'Обзор', path: `/dashboard/${slug}` },
    { icon: Calendar, label: 'Календарь', path: `/dashboard/${slug}/calendar` },
    { icon: ListTodo, label: 'Записи', path: `/dashboard/${slug}/bookings` },
    { icon: Scissors, label: 'Услуги', path: `/dashboard/${slug}/services` },
    { icon: Users, label: 'Мастера', path: `/dashboard/${slug}/staff` },
    { icon: Users, label: 'Клиенты', path: `/dashboard/${slug}/clients` },
    { icon: Ticket, label: 'Промокоды', path: `/dashboard/${slug}/promocodes` },
    { icon: MessageSquare, label: 'Отзывы', path: `/dashboard/${slug}/reviews` },
    { icon: Sparkles, label: 'Портфолио', path: `/dashboard/${slug}/portfolio` },
    { icon: Settings, label: 'Настройки', path: `/dashboard/${slug}/settings` },
  ];

  const sidebarContent = (isMobile = false) => (
    <div className="flex flex-col h-full bg-white">
      <div className="p-6 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
            B
          </div>
          <span className="text-xl font-bold tracking-tight">BookBot</span>
        </div>
        {isMobile && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsMobileMenuOpen(false)}
            className="rounded-full h-8 w-8 hover:bg-slate-100"
          >
            <X className="w-5 h-5 text-slate-500" />
          </Button>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto w-full">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => isMobile && setIsMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group",
                isActive 
                  ? "bg-blue-50 text-blue-600 shadow-sm shadow-blue-100" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-50 space-y-2">
        <Link to="/" onClick={() => isMobile && setIsMobileMenuOpen(false)}>
          <Button variant="ghost" className="w-full justify-start text-slate-500 hover:text-slate-900">
            <ChevronLeft className="w-4 h-4 mr-2" />
            На сайт
          </Button>
        </Link>
        <Button 
          variant="ghost" 
          className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50"
          onClick={() => {
            localStorage.removeItem('ownerToken');
            localStorage.removeItem('userRole');
            window.location.href = '/';
          }}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Выйти
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50">
      
      {/* Mobile Sticky Top Header */}
      <div className="md:hidden sticky top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
            B
          </div>
          <span className="text-xl font-bold tracking-tight">BookBot</span>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setIsMobileMenuOpen(true)}
          className="rounded-xl h-10 w-10 text-slate-600"
        >
          <Menu className="w-6 h-6" />
        </Button>
      </div>

      {/* Slide-out Mobile Menu (Drawer) using AnimatePresence */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            />
            {/* Drawer Container */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="absolute top-0 bottom-0 left-0 w-[280px] sm:w-[320px] max-w-[85vw] bg-white shadow-2xl h-full flex flex-col"
            >
              {sidebarContent(true)}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar (Permanent) */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col sticky top-0 h-screen shrink-0">
        {sidebarContent(false)}
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 w-full min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
