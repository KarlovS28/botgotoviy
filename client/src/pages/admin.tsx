import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { getCurrentUser, logout } from "@/lib/api";
import AdminPanel from "@/components/AdminPanel";
import { Button } from "@/components/ui/button";

export default function AdminPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          navigate("/");
          return;
        }
        
        if (!user.isAdmin) {
          toast({
            variant: "destructive",
            title: "Доступ запрещен",
            description: "У вас нет прав администратора",
          });
          navigate("/");
          return;
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error("Authentication check failed:", error);
        navigate("/");
      }
    };

    checkAuth();
  }, [navigate, toast]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em]"></div>
          <p className="mt-2 text-sm text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  return <AdminPanel onLogout={handleLogout} />;
}
