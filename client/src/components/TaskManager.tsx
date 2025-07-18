import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { getUsers, getTasks, createTask, updateTaskStatus, assignTask } from "@/lib/api";
import { LucidePencil, LucideCheckCircle, LucideAlertCircle, LucideClock, LucidePlus } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { TASK_STATUS } from "@shared/schema";

const taskFormSchema = z.object({
  title: z.string().min(1, "Введите название задачи"),
  description: z.string().min(1, "Введите описание задачи"),
  assignedToUserId: z.string().min(1, "Выберите исполнителя").optional(),
  status: z.string().min(1, "Выберите статус")
});

const statusLabels = {
  [TASK_STATUS.NEW]: { name: "Новая", icon: <LucideClock className="h-4 w-4" />, class: "bg-blue-100 text-blue-800" },
  [TASK_STATUS.IN_PROGRESS]: { name: "В процессе", icon: <LucideClock className="h-4 w-4" />, class: "bg-yellow-100 text-yellow-800" },
  [TASK_STATUS.COMPLETED]: { name: "Выполнено", icon: <LucideCheckCircle className="h-4 w-4" />, class: "bg-green-100 text-green-800" },
  [TASK_STATUS.URGENT]: { name: "Срочно", icon: <LucideAlertCircle className="h-4 w-4" />, class: "bg-red-100 text-red-800" }
};

export default function TaskManager() {
  const [users, setUsers] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof taskFormSchema>>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      assignedToUserId: "",
      status: TASK_STATUS.NEW
    }
  });

  useEffect(() => {
    fetchUsers();
    fetchTasks();
  }, []);

  useEffect(() => {
    // Filter tasks based on active tab
    if (activeTab === "all") {
      setFilteredTasks(tasks);
    } else {
      setFilteredTasks(tasks.filter(task => task.status === activeTab));
    }
  }, [activeTab, tasks]);

  useEffect(() => {
    if (selectedTask) {
      form.reset({
        title: selectedTask.title,
        description: selectedTask.description || "",
        assignedToUserId: selectedTask.assignedToUserId?.toString() || "",
        status: selectedTask.status
      });
    } else {
      form.reset({
        title: "",
        description: "",
        assignedToUserId: undefined,
        status: TASK_STATUS.NEW
      });
    }
  }, [selectedTask, form]);

  async function fetchUsers() {
    try {
      const data = await getUsers();
      // Filter only SysAdmins for task assignees
      const sysAdmins = Array.isArray(data) 
        ? data.filter(user => user.role === "sysadmin")
        : [];
      setUsers(sysAdmins);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  }

  async function fetchTasks() {
    try {
      setIsLoading(true);
      const data = await getTasks();
      setTasks(Array.isArray(data) ? data : []);
      setFilteredTasks(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось загрузить задачи"
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleOpenAddDialog() {
    setSelectedTask(null);
    setIsDialogOpen(true);
  }

  function handleOpenEditDialog(task: any) {
    setSelectedTask(task);
    setIsDialogOpen(true);
  }

  async function changeTaskStatus(taskId: number, status: string) {
    try {
      await updateTaskStatus(taskId, status);
      await fetchTasks();
      
      toast({
        title: "Успешно",
        description: "Статус задачи обновлен"
      });
    } catch (error) {
      console.error("Failed to update task status:", error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось обновить статус задачи"
      });
    }
  }

  async function onSubmit(values: z.infer<typeof taskFormSchema>) {
    try {
      if (selectedTask) {
        // Update task status
        await updateTaskStatus(selectedTask.id, values.status);
        
        // Assign task to user if specified
        if (values.assignedToUserId) {
          await assignTask(selectedTask.id, parseInt(values.assignedToUserId, 10));
        }
      } else {
        // Create new task
        await createTask({
          title: values.title,
          description: values.description,
          status: values.status,
          assignedToUserId: values.assignedToUserId ? parseInt(values.assignedToUserId, 10) : null
        });
      }
      
      // Close dialog and refresh data
      setIsDialogOpen(false);
      await fetchTasks();
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      
      toast({
        title: "Успешно",
        description: selectedTask 
          ? "Задача обновлена" 
          : "Задача создана"
      });
    } catch (error) {
      console.error("Failed to save task:", error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось сохранить задачу"
      });
    }
  }

  const TaskItem = ({ task }: { task: any }) => {
    const statusInfo = statusLabels[task.status as keyof typeof statusLabels] || 
      { name: task.status, icon: <LucideClock className="h-4 w-4" />, class: "bg-gray-100 text-gray-800" };
    
    const assignedTo = users.find(u => u.id === task.assignedToUserId);
    const createdBy = task.createdByUser?.lastName 
      ? `${task.createdByUser.lastName} ${task.createdByUser.firstName}`
      : "Неизвестно";

    return (
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-2">
            <div className="font-medium">{task.title}</div>
            <Badge variant="outline" className={statusInfo.class}>
              <span className="flex items-center">
                {statusInfo.icon}
                <span className="ml-1">{statusInfo.name}</span>
              </span>
            </Badge>
          </div>
          
          <div className="text-sm text-muted-foreground mb-3">
            {task.description}
          </div>
          
          <div className="flex justify-between items-center text-xs">
            <div className="text-muted-foreground">
              От: {createdBy}
            </div>
            <div className="text-muted-foreground">
              Исполнитель: {assignedTo 
                ? `${assignedTo.lastName} ${assignedTo.firstName}` 
                : "Не назначен"}
            </div>
          </div>
          
          <div className="mt-3 pt-3 border-t flex justify-between">
            <div className="text-xs text-muted-foreground">
              {new Date(task.createdAt).toLocaleString('ru-RU')}
            </div>
            
            <div className="flex space-x-2">
              {task.status !== TASK_STATUS.COMPLETED && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => changeTaskStatus(task.id, TASK_STATUS.COMPLETED)}
                  className="text-green-600"
                >
                  <LucideCheckCircle className="h-4 w-4 mr-1" />
                  Выполнено
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <Tabs 
          defaultValue="all" 
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList>
            <TabsTrigger value="all">Все</TabsTrigger>
            <TabsTrigger value={TASK_STATUS.NEW}>Новые</TabsTrigger>
            <TabsTrigger value={TASK_STATUS.IN_PROGRESS}>В процессе</TabsTrigger>
            <TabsTrigger value={TASK_STATUS.URGENT}>Срочные</TabsTrigger>
            <TabsTrigger value={TASK_STATUS.COMPLETED}>Выполненные</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      <div>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="w-full">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="h-5 bg-muted animate-pulse rounded-md w-1/3"></div>
                    <div className="h-5 bg-muted animate-pulse rounded-md w-24"></div>
                  </div>
                  <div className="h-12 bg-muted animate-pulse rounded-md mb-3"></div>
                  <div className="flex justify-between">
                    <div className="h-4 bg-muted animate-pulse rounded-md w-1/4"></div>
                    <div className="h-4 bg-muted animate-pulse rounded-md w-1/4"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredTasks.length > 0 ? (
          <div>
            {filteredTasks.map(task => (
              <TaskItem key={task.id} task={task} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-muted-foreground">Задачи не найдены</div>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Add/Edit Task Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedTask ? "Редактировать задачу" : "Создать задачу"}
            </DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Название задачи</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Введите название задачи" 
                        {...field} 
                        disabled={!!selectedTask}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Описание задачи</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Введите подробное описание задачи" 
                        rows={4} 
                        {...field} 
                        disabled={!!selectedTask}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="assignedToUserId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Назначить исполнителя</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите системного администратора" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Не назначен</SelectItem>
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
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Статус</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите статус" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={TASK_STATUS.NEW}>Новая</SelectItem>
                        <SelectItem value={TASK_STATUS.IN_PROGRESS}>В процессе</SelectItem>
                        <SelectItem value={TASK_STATUS.URGENT}>Срочно</SelectItem>
                        <SelectItem value={TASK_STATUS.COMPLETED}>Выполнено</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="submit" className="w-full">
                  {selectedTask ? "Обновить задачу" : "Создать задачу"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
