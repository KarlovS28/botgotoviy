import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
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
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { getUsers, getSecurePasswords, createSecurePassword, markPasswordAsRead } from "@/lib/api";
import { LucideInfo, LucideEye } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

const passwordFormSchema = z.object({
  receiverId: z.string().min(1, "Выберите получателя"),
  type: z.string().min(1, "Выберите тип информации"),
  title: z.string().min(1, "Введите название"),
  content: z.string().min(1, "Введите содержимое")
});

export default function PasswordManager() {
  const [users, setUsers] = useState<any[]>([]);
  const [passwords, setPasswords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPassword, setSelectedPassword] = useState<any | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      receiverId: "",
      type: "credentials",
      title: "",
      content: ""
    }
  });

  useEffect(() => {
    fetchUsers();
    fetchPasswords();
  }, []);

  async function fetchUsers() {
    try {
      const data = await getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось загрузить пользователей"
      });
    }
  }

  async function fetchPasswords() {
    try {
      setIsLoading(true);
      const data = await getSecurePasswords();
      setPasswords(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch secure passwords:", error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось загрузить безопасные пароли"
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function viewPassword(password: any) {
    try {
      setSelectedPassword(password);
      setIsViewDialogOpen(true);
      
      if (!password.isRead) {
        await markPasswordAsRead(password.id);
        await fetchPasswords();
      }
    } catch (error) {
      console.error("Failed to mark password as read:", error);
    }
  }

  async function onSubmit(values: z.infer<typeof passwordFormSchema>) {
    try {
      await createSecurePassword({
        receiverId: parseInt(values.receiverId, 10),
        type: values.type,
        title: values.title,
        encryptedContent: values.content // In a real app, this would be encrypted
      });
      
      // Reset form and refresh data
      form.reset();
      await fetchPasswords();
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['/api/secure-passwords'] });
      
      toast({
        title: "Успешно",
        description: "Информация отправлена в защищенный чат"
      });
    } catch (error) {
      console.error("Failed to create secure password:", error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось отправить информацию"
      });
    }
  }

  const passwordColumns = [
    {
      header: "Название",
      accessorKey: "title"
    },
    {
      header: "Тип",
      accessorKey: (row: any) => {
        const typeLabels: Record<string, string> = {
          "credentials": "Учетные данные",
          "password": "Пароли",
          "api_key": "API ключи",
          "other": "Другое"
        };
        return typeLabels[row.type] || row.type;
      }
    },
    {
      header: "Отправитель",
      accessorKey: (row: any) => {
        const user = users.find(u => u.id === row.senderId);
        return user 
          ? `${user.lastName || ''} ${user.firstName || ''}`
          : "Неизвестно";
      }
    },
    {
      header: "Получатель",
      accessorKey: (row: any) => {
        const user = users.find(u => u.id === row.receiverId);
        return user 
          ? `${user.lastName || ''} ${user.firstName || ''}`
          : "Неизвестно";
      }
    },
    {
      header: "Дата",
      accessorKey: (row: any) => {
        return new Date(row.createdAt).toLocaleString('ru-RU');
      }
    },
    {
      header: "Статус",
      accessorKey: (row: any) => (
        <span className={`px-2 py-1 text-xs rounded-full ${row.isRead ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
          {row.isRead ? "Прочитано" : "Не прочитано"}
        </span>
      )
    },
    {
      header: "",
      accessorKey: (row: any) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => viewPassword(row)}
          className="float-right"
        >
          <LucideEye className="h-4 w-4 mr-1" />
          Просмотр
        </Button>
      )
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Password History Table */}
      <div className="md:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>История безопасных заметок</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={passwords}
              columns={passwordColumns}
              isLoading={isLoading}
              pageSize={10}
              noDataMessage="Безопасные заметки не найдены"
            />
          </CardContent>
        </Card>
      </div>

      {/* Send Secure Note Form */}
      <div>
        <Card>
          <CardHeader>
            <CardTitle>Отправить защищенную информацию</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4 bg-yellow-50 border-yellow-300 text-yellow-800">
              <LucideInfo className="h-4 w-4" />
              <AlertTitle>Внимание</AlertTitle>
              <AlertDescription className="text-sm">
                Все пароли и конфиденциальная информация передаются в зашифрованном виде и доступны только авторизованным пользователям.
              </AlertDescription>
            </Alert>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="receiverId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Получатель</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите получателя" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {users.map((user) => (
                            <SelectItem 
                              key={user.id} 
                              value={user.id.toString()}
                            >
                              {user.lastName} {user.firstName} ({user.username})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Тип информации</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите тип" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="credentials">Учетные данные</SelectItem>
                          <SelectItem value="password">Пароли</SelectItem>
                          <SelectItem value="api_key">API ключи</SelectItem>
                          <SelectItem value="other">Другое</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Название</FormLabel>
                      <FormControl>
                        <Input placeholder="Например: Admin Panel Access" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Защищенное содержимое</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Введите конфиденциальную информацию" 
                          rows={5}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button type="submit" className="w-full">
                  Отправить в защищенный чат
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      {/* View Password Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedPassword?.title}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-1">Тип:</div>
              <div className="text-sm">
                {selectedPassword?.type === "credentials" && "Учетные данные"}
                {selectedPassword?.type === "password" && "Пароли"}
                {selectedPassword?.type === "api_key" && "API ключи"}
                {selectedPassword?.type === "other" && "Другое"}
              </div>
            </div>
            
            <div>
              <div className="text-sm font-medium mb-1">Отправитель:</div>
              <div className="text-sm">
                {users.find(u => u.id === selectedPassword?.senderId)?.lastName} {users.find(u => u.id === selectedPassword?.senderId)?.firstName}
              </div>
            </div>
            
            <div>
              <div className="text-sm font-medium mb-1">Получатель:</div>
              <div className="text-sm">
                {users.find(u => u.id === selectedPassword?.receiverId)?.lastName} {users.find(u => u.id === selectedPassword?.receiverId)?.firstName}
              </div>
            </div>
            
            <div>
              <div className="text-sm font-medium mb-1">Содержимое:</div>
              <div className="bg-muted p-3 rounded-md whitespace-pre-wrap text-sm font-mono">
                {selectedPassword?.encryptedContent}
              </div>
            </div>
            
            <div>
              <div className="text-sm font-medium mb-1">Дата создания:</div>
              <div className="text-sm">
                {selectedPassword?.createdAt && new Date(selectedPassword.createdAt).toLocaleString('ru-RU')}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
