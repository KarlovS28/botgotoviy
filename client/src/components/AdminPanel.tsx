import { useState } from "react";
import { LucideMenu, LucideSearch, LucideBell, LucideRefreshCw } from "lucide-react";
import { useMobile } from "@/hooks/use-mobile";
import Dashboard from "@/components/Dashboard";
import UserManager from "@/components/UserManager";
import EquipmentManager from "@/components/EquipmentManager";
import PasswordManager from "@/components/PasswordManager";
import TaskManager from "@/components/TaskManager";
import Settings from "@/components/Settings";

interface AdminPanelProps {
  onLogout: () => void;
}

type ActiveTab = "dashboard" | "users" | "equipment" | "passwords" | "tasks" | "settings";

export default function AdminPanel({ onLogout }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isMobile = useMobile();

  const toggleSidebar = () => {
    setMobileSidebarOpen(!mobileSidebarOpen);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div 
        className={`bg-sidebar text-sidebar-foreground ${
          isMobile ? (mobileSidebarOpen ? "fixed inset-0 z-50" : "hidden") : "w-64 flex-shrink-0"
        }`}
      >
        <div className="p-4 flex items-center border-b border-sidebar-border">
          <span className="mr-2">👤</span>
          <div className="font-medium">Администратор</div>
        </div>
        
        <nav className="mt-4">
          <div className="px-4 py-2 text-sm text-sidebar-foreground/70 uppercase tracking-wider">Основное меню</div>
          
          <a 
            href="#" 
            onClick={(e) => { e.preventDefault(); setActiveTab("dashboard"); if (isMobile) setMobileSidebarOpen(false); }}
            className={`sidebar-link ${activeTab === "dashboard" ? "active" : ""}`}
          >
            <span className="mr-3">📊</span>
            <span>Главная</span>
          </a>
          
          <a 
            href="#" 
            onClick={(e) => { e.preventDefault(); setActiveTab("users"); if (isMobile) setMobileSidebarOpen(false); }}
            className={`sidebar-link ${activeTab === "users" ? "active" : ""}`}
          >
            <span className="mr-3">👥</span>
            <span>Пользователи</span>
          </a>
          
          <a 
            href="#" 
            onClick={(e) => { e.preventDefault(); setActiveTab("equipment"); if (isMobile) setMobileSidebarOpen(false); }}
            className={`sidebar-link ${activeTab === "equipment" ? "active" : ""}`}
          >
            <span className="mr-3">💻</span>
            <span>Мат.ответственность</span>
          </a>
          
          <a 
            href="#" 
            onClick={(e) => { e.preventDefault(); setActiveTab("passwords"); if (isMobile) setMobileSidebarOpen(false); }}
            className={`sidebar-link ${activeTab === "passwords" ? "active" : ""}`}
          >
            <span className="mr-3">🔑</span>
            <span>Пароли</span>
          </a>
          
          <a 
            href="#" 
            onClick={(e) => { e.preventDefault(); setActiveTab("tasks"); if (isMobile) setMobileSidebarOpen(false); }}
            className={`sidebar-link ${activeTab === "tasks" ? "active" : ""}`}
          >
            <span className="mr-3">📝</span>
            <span>Задачи</span>
          </a>
          
          <div className="px-4 py-2 mt-6 text-sm text-sidebar-foreground/70 uppercase tracking-wider">Настройки</div>
          
          <a 
            href="#" 
            onClick={(e) => { e.preventDefault(); setActiveTab("settings"); if (isMobile) setMobileSidebarOpen(false); }}
            className={`sidebar-link ${activeTab === "settings" ? "active" : ""}`}
          >
            <span className="mr-3">⚙️</span>
            <span>Настройки бота</span>
          </a>
          
          <a 
            href="#" 
            onClick={(e) => { e.preventDefault(); onLogout(); }}
            className="sidebar-link text-destructive hover:text-destructive/90"
          >
            <span className="mr-3">🚪</span>
            <span>Выйти</span>
          </a>
        </nav>
      </div>
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-card shadow-sm flex items-center justify-between p-4">
          <div className="flex items-center md:hidden">
            <button 
              className="p-1 rounded-md hover:bg-muted"
              onClick={toggleSidebar}
            >
              <LucideMenu className="h-6 w-6" />
            </button>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="flex items-center bg-card border rounded-md px-3 py-1">
              <LucideSearch className="text-muted-foreground mr-2 h-4 w-4" />
              <input type="text" placeholder="Поиск..." className="border-none focus:ring-0 text-sm bg-transparent" />
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button className="p-1 rounded-md hover:bg-muted relative">
              <LucideBell className="h-5 w-5" />
              <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-destructive"></span>
            </button>
            
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium">
                А
              </div>
            </div>
          </div>
        </header>
        
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4">
          <div className="container mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-semibold text-foreground">
                {activeTab === "dashboard" && "Панель администратора"}
                {activeTab === "users" && "Управление пользователями"}
                {activeTab === "equipment" && "Управление имуществом"}
                {activeTab === "passwords" && "Безопасные пароли"}
                {activeTab === "tasks" && "Управление задачами"}
                {activeTab === "settings" && "Настройки бота"}
              </h1>
              <div className="flex space-x-2">
                <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md flex items-center text-sm">
                  <LucideRefreshCw className="mr-1 h-4 w-4" />
                  Обновить данные
                </button>
              </div>
            </div>
            
            {activeTab === "dashboard" && <Dashboard />}
            {activeTab === "users" && <UserManager />}
            {activeTab === "equipment" && <EquipmentManager />}
            {activeTab === "passwords" && <PasswordManager />}
            {activeTab === "tasks" && <TaskManager />}
            {activeTab === "settings" && <Settings />}
          </div>
        </main>
      </div>
    </div>
  );
}
