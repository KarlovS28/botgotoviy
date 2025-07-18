import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { getUsers, updateUserRole, updateUserPermissions, deleteUser } from "@/lib/api";
import { LucideEdit, LucideTrash2, LucidePlus } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { ROLES, CHAT_TYPES } from "@shared/schema";

interface UserManagerProps {
  limit?: number;
  showAsCard?: boolean;
}

const userFormSchema = z.object({
  userId: z.number(),
  role: z.string(),
  permissions: z.object({
    [CHAT_TYPES.EQUIPMENT]: z.boolean().default(false),
    [CHAT_TYPES.PASSWORDS]: z.boolean().default(false),
    [CHAT_TYPES.TASKS]: z.boolean().default(false)
  })
});

type RoleLabel = {
  [key: string]: { name: string; class: string; };
};

const roleLabels: RoleLabel = {
  [ROLES.SYSADMIN]: { name: "Системный Администратор", class: "bg-primary bg-blue-100 text-back-800" },
  [ROLES.ACCOUNTANT]: { name: "Бухгалтер", class: "bg-yellow-100 text-yellow-800" },
  [ROLES.MANAGER]: { name: "Руководитель", class: "bg-green-100 text-green-800" },
  [ROLES.EMPLOYEE]: { name: "Сотрудник", class: "bg-gray-100 text-gray-800" },
  [ROLES.ADMIN]: { name: "Администратор", class: "bg-red-100 text-red-800" }
};

const chatLabels = {
  [CHAT_TYPES.EQUIPMENT]: { name: "Мат.отв.", description: "Доступ к информации о технике и имуществе" },
  [CHAT_TYPES.PASSWORDS]: { name: "Пароли", description: "Обмен защищенной информацией" },
  [CHAT_TYPES.TASKS]: { name: "Задачи", description: "Постановка задач системным администраторам" }
};

export default function UserManager({ limit, showAsCard = false }: UserManagerProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      userId: 0,
      role: ROLES.EMPLOYEE,
      permissions: {
        [CHAT_TYPES.EQUIPMENT]: false,
        [CHAT_TYPES.PASSWORDS]: false,
        [CHAT_TYPES.TASKS]: false
      }
    }
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      form.reset({
        userId: selectedUser.id,
        role: selectedUser.role || ROLES.EMPLOYEE,
        permissions: {
          [CHAT_TYPES.EQUIPMENT]: selectedUser.permissions?.[CHAT_TYPES.EQUIPMENT] || false,
          [CHAT_TYPES.PASSWORDS]: selectedUser.permissions?.[CHAT_TYPES.PASSWORDS] || false,
          [CHAT_TYPES.TASKS]: selectedUser.permissions?.[CHAT_TYPES.TASKS] || false
        }
      });
    }
  }, [selectedUser, form]);

  async function fetchUsers() {
    try {
      setIsLoading(true);
      const data = await getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось загрузить пользователей"
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteUser(userId: number) {
    if (!confirm("Вы уверены, что хотите удалить этого пользователя?")) {
      return;
    }

    try {
      await deleteUser(userId);
      await fetchUsers();
      toast({
        title: "Успешно",
        description: "Пользователь успешно удален"
      });
    } catch (error) {
      console.error("Failed to delete user:", error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось удалить пользователя"
      });
    }
  }

  async function onSubmit(values: z.infer<typeof userFormSchema>) {
    try {
      // Update role
      await updateUserRole(values.userId, values.role);
      
      // Update permissions
      await updateUserPermissions(values.userId, values.permissions);
      
      // Close dialog and refresh data
      setIsDialogOpen(false);
      await fetchUsers();
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      
      toast({
        title: "Успешно",
        description: "Настройки пользователя обновлены"
      });
    } catch (error) {
      console.error("Failed to update user:", error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось обновить настройки пользователя"
      });
    }
  }

  const columns = [
    {
      header: "Пользователь",
      accessorKey: (row: any) => (
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-medium mr-3">
            {row.firstName?.charAt(0) || row.username?.charAt(0) || '?'}
          </div>
          <div>
            <div className="text-sm font-medium">
              {row.firstName && row.lastName 
                ? `${row.lastName} ${row.firstName}`
                : row.username || "Неизвестный пользователь"}
            </div>
            <div className="text-xs text-muted-foreground">
              @{row.username || row.telegramId}
            </div>
          </div>
        </div>
      )
    },
    {
      header: "Роль",
      accessorKey: (row: any) => {
        const roleName = roleLabels[row.role]?.name || "Неизвестно";
        const roleClass = roleLabels[row.role]?.class || "bg-gray-100 text-gray-800";
        return (
          <span className={`px-2 py-1 text-xs rounded-full ${roleClass}`}>
            {roleName}
          </span>
        );
      }
    },
    {
      header: "Доступ к чатам",
      accessorKey: (row: any) => (
        <div className="flex space-x-1">
          {row.permissions?.[CHAT_TYPES.EQUIPMENT] && 
            <span className="px-2 py-1 text-xs rounded-md bg-gray-100">Мат.отв.</span>
          }
          {row.permissions?.[CHAT_TYPES.PASSWORDS] && 
            <span className="px-2 py-1 text-xs rounded-md bg-gray-100">Пароли</span>
          }
          {row.permissions?.[CHAT_TYPES.TASKS] && 
            <span className="px-2 py-1 text-xs rounded-md bg-gray-100">Задачи</span>
          }
          {(!row.permissions?.[CHAT_TYPES.EQUIPMENT] && 
            !row.permissions?.[CHAT_TYPES.PASSWORDS] && 
            !row.permissions?.[CHAT_TYPES.TASKS]) && 
            <span className="text-xs text-muted-foreground">Нет доступа</span>
          }
        </div>
      )
    },
    {
      header: "Действия",
      accessorKey: (row: any) => (
        <div className="flex justify-end space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedUser(row);
              setIsDialogOpen(true);
            }}
            className="text-primary hover:text-primary/80"
          >
            <LucideEdit className="h-4 w-4" />
            <span className="sr-only">Редактировать</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDeleteUser(row.id)}
            className="text-destructive hover:text-destructive/80"
          >
            <LucideTrash2 className="h-4 w-4" />
            <span className="sr-only">Удалить</span>
          </Button>
        </div>
      )
    }
  ];

  // Get limited data if requested
  const displayData = limit ? users.slice(0, limit) : users;

  const Table = (
    <>
      <DataTable
        data={displayData}
        columns={columns}
        isLoading={isLoading}
        pageSize={limit || 10}
        noDataMessage="Пользователи не найдены"
      />
      
      {limit && users.length > limit && (
        <div className="flex justify-center mt-4">
          <Button variant="outline">Показать все пользователи</Button>
        </div>
      )}
    </>
  );

  return (
    <>
      {showAsCard ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Управление пользователями</CardTitle>
            <Button variant="outline" size="sm" className="text-primary">
              <LucidePlus className="h-4 w-4 mr-1" />
              Добавить пользователя
            </Button>
          </CardHeader>
          <CardContent>{Table}</CardContent>
        </Card>
      ) : (
        Table
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Управление доступом</DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <h3 className="text-sm font-medium mb-2">Пользователь</h3>
                <div className="text-sm">
                  {selectedUser?.firstName && selectedUser?.lastName 
                    ? `${selectedUser.lastName} ${selectedUser.firstName}`
                    : selectedUser?.username || "Неизвестный пользователь"}
                  {selectedUser?.username && <span className="text-muted-foreground ml-1">(@{selectedUser.username})</span>}
                </div>
              </div>
              
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Роль</FormLabel>
                    <div className="flex flex-wrap gap-2">
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Выберите роль" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ROLES.SYSADMIN}>СисАдмин</SelectItem>
                          <SelectItem value={ROLES.ACCOUNTANT}>Бухгалтер</SelectItem>
                          <SelectItem value={ROLES.MANAGER}>Руководитель</SelectItem>
                          <SelectItem value={ROLES.EMPLOYEE}>Сотрудник</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </FormItem>
                )}
              />
              
              <div className="space-y-4">
                <FormLabel className="block text-sm font-medium">Доступ к чатам</FormLabel>
                <div className="space-y-2">
                  {Object.entries(chatLabels).map(([chatType, { name, description }]) => (
                    <FormField
                      key={chatType}
                      control={form.control}
                      name={`permissions.${chatType}` as any}
                      render={({ field }) => (
                        <FormItem className="flex items-center p-2 border rounded-md hover:bg-muted cursor-pointer">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="ml-2">
                            <div className="font-medium">{name}</div>
                            <div className="text-xs text-muted-foreground">{description}</div>
                          </div>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              </div>
              
              <DialogFooter>
                <Button type="submit" className="w-full">
                  Сохранить настройки доступа
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
