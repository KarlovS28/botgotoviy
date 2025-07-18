import { useEffect, useState } from "react";
import { LucideUsers, LucideMonitor, LucideClipboardList, LucideShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getUsers, getEquipment, getTasks } from "@/lib/api";
import UserManager from "@/components/UserManager";

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalEquipment: 0,
    activeTasks: 0,
    admins: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [users, equipment, tasks] = await Promise.all([
          getUsers(),
          getEquipment(),
          getTasks()
        ]);
        
        setStats({
          totalUsers: Array.isArray(users) ? users.length : 0,
          totalEquipment: Array.isArray(equipment) ? equipment.length : 0,
          activeTasks: Array.isArray(tasks) ? tasks.filter(t => t.status !== 'completed').length : 0,
          admins: Array.isArray(users) ? users.filter(u => u.isAdmin).length : 0
        });
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="w-full">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="h-4 w-24 bg-muted animate-pulse rounded-md mb-2"></div>
                  <div className="h-8 w-12 bg-muted animate-pulse rounded-md"></div>
                </div>
                <div className="w-10 h-10 rounded-full bg-muted animate-pulse"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Пользователей</div>
              <div className="text-2xl font-semibold mt-1">{stats.totalUsers}</div>
            </div>
            <div className="stat-icon bg-primary bg-opacity-10">
              <LucideUsers className="h-5 w-5 text-primary" />
            </div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Единиц имущества</div>
              <div className="text-2xl font-semibold mt-1">{stats.totalEquipment}</div>
            </div>
            <div className="stat-icon bg-green-100">
              <LucideMonitor className="h-5 w-5 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Активных задач</div>
              <div className="text-2xl font-semibold mt-1">{stats.activeTasks}</div>
            </div>
            <div className="stat-icon bg-yellow-100">
              <LucideClipboardList className="h-5 w-5 text-yellow-600" />
            </div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Админов</div>
              <div className="text-2xl font-semibold mt-1">{stats.admins}</div>
            </div>
            <div className="stat-icon bg-red-100">
              <LucideShieldAlert className="h-5 w-5 text-red-600" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Recent users panel */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        <UserManager limit={5} showAsCard={true} />
      </div>
    </>
  );
}
