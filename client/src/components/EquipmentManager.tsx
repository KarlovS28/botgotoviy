import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { getEquipment, getUsers, addEquipment, updateEquipment, getEquipmentHistory } from "@/lib/api";
import { LucideEdit, LucideSearch, LucideUpload, LucidePlus, LucideHistory, LucideDownload } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { EQUIPMENT_STATUS } from "@shared/schema";

const equipmentFormSchema = z.object({
  id: z.number().optional(),
  inventoryNumber: z.string().min(1, "Инвентарный номер обязателен"),
  name: z.string().min(1, "Название обязательно"),
  type: z.string().min(1, "Тип обязателен"),
  status: z.string().min(1, "Статус обязателен"),
  assignedToUserId: z.number().nullable().optional(),
  description: z.string().optional()
});

const statusLabels = {
  [EQUIPMENT_STATUS.ACTIVE]: { name: "Активно", class: "bg-green-100 text-green-800" },
  [EQUIPMENT_STATUS.STORAGE]: { name: "На складе", class: "bg-gray-100 text-gray-800" },
  [EQUIPMENT_STATUS.REPAIR]: { name: "На ремонте", class: "bg-yellow-100 text-yellow-800" },
  [EQUIPMENT_STATUS.DECOMMISSIONED]: { name: "Не используется", class: "bg-red-100 text-red-800" },
  [EQUIPMENT_STATUS.WRITTEN_OFF]: { name: "Списано", class: "bg-red-300 text-red-900" }
};

const EQUIPMENT_TYPES = [
  "Ноутбук",
  "Монитор",
  "Сетевое оборудование",
  "Стол",
  "Кресло",
  "Тумбочка",
  "Стеллаж",
  "Шкаф",
  "Прочая офисная мебель",
  "Монитор",
  "Системный блок",
  "мышь",
  "клавиатура",
  "IMac",
  "MacBook",
  "коврик",
  "комплектующие",
  "ИБП",
  "Прочее"
];

export default function EquipmentManager() {
  const [equipment, setEquipment] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<any | null>(null);
  const [equipmentHistory, setEquipmentHistory] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [searchInventory, setSearchInventory] = useState("");
  const [searchEmployee, setSearchEmployee] = useState("");
  const { toast } = useToast();

  const form = useForm<z.infer<typeof equipmentFormSchema>>({
    resolver: zodResolver(equipmentFormSchema),
    defaultValues: {
      inventoryNumber: "",
      name: "",
      type: "",
      status: EQUIPMENT_STATUS.STORAGE,
      assignedToUserId: null,
      description: ""
    }
  });

  useEffect(() => {
    fetchEquipment();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedEquipment) {
      form.reset({
        id: selectedEquipment.id,
        inventoryNumber: selectedEquipment.inventoryNumber,
        name: selectedEquipment.name,
        type: selectedEquipment.type,
        status: selectedEquipment.status,
        assignedToUserId: selectedEquipment.assignedToUserId || null,
        description: selectedEquipment.description || ""
      });
    } else {
      form.reset({
        inventoryNumber: "",
        name: "",
        type: "",
        status: EQUIPMENT_STATUS.STORAGE,
        assignedToUserId: null,
        description: ""
      });
    }
  }, [selectedEquipment, form]);

  async function fetchEquipment() {
    try {
      setIsLoading(true);
      const data = await getEquipment();
      setEquipment(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch equipment:", error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось загрузить данные об имуществе"
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchUsers() {
    try {
      const data = await getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  }

  async function fetchEquipmentHistory(equipmentId: number) {
    if (!equipmentId) return;

    try {
      setIsHistoryLoading(true);
      const data = await getEquipmentHistory(equipmentId);
      setEquipmentHistory(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch equipment history:", error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось загрузить историю имущества"
      });
    } finally {
      setIsHistoryLoading(false);
    }
  }

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return;

    const file = event.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/equipment/import', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Import failed');
      }

      toast({
        title: "Успешно",
        description: "Данные импортированы"
      });

      await fetchEquipment();
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message || "Не удалось импортировать данные"
      });
    } finally {
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  function handleSearch() {
    fetchEquipment();
  }

  function handleOpenAddDialog() {
    setSelectedEquipment(null);
    setIsDialogOpen(true);
  }

  function handleOpenEditDialog(equipment: any) {
    setSelectedEquipment(equipment);
    setIsDialogOpen(true);
  }

  function handleOpenHistoryDialog(equipment: any) {
    setSelectedEquipment(equipment);
    fetchEquipmentHistory(equipment.id);
    setIsHistoryDialogOpen(true);
  }

  async function onSubmit(values: z.infer<typeof equipmentFormSchema>) {
    try {
      const formData = {
        ...values,
        assignedToUserId: values.assignedToUserId || null,
        department: values.department || null, //Added department field
        description: values.description || null //Added description field
      };

      if (selectedEquipment?.id) {
        await updateEquipment(selectedEquipment.id, formData);
      } else {
        await addEquipment(formData);
      }

      setIsDialogOpen(false);
      await fetchEquipment();

      toast({
        title: "Успешно",
        description: selectedEquipment?.id 
          ? "Данные имущества обновлены" 
          : "Имущество успешно добавлено"
      });
    } catch (error) {
      console.error("Failed to save equipment:", error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось сохранить данные имущества"
      });
    }
  }

  const columns = [
    {
      header: "Инв. номер",
      accessorKey: "inventoryNumber"
    },
    {
      header: "Наименование",
      accessorKey: "name"
    },
    {
      header: "Тип",
      accessorKey: "type"
    },
    {
      header: "Закреплено за",
      accessorKey: (row: any) => {
        const user = users.find(u => u.id === row.assignedToUserId);
        return user 
          ? `${user.lastName || ''} ${user.firstName || ''}`
          : "—";
      }
    },
    {
      header: "Статус",
      accessorKey: (row: any) => {
        const status = statusLabels[row.status as keyof typeof statusLabels];
        return (
          <span className={`px-2 py-1 text-xs rounded-full ${status?.class || "bg-gray-100 text-gray-800"}`}>
            {status?.name || row.status}
          </span>
        );
      }
    },
    {
      header: "Действия",
      accessorKey: (row: any) => (
        <div className="flex justify-end space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleOpenEditDialog(row)}
            className="text-primary hover:text-primary/80"
          >
            <LucideEdit className="h-4 w-4" />
            <span className="sr-only">Редактировать</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleOpenHistoryDialog(row)}
            className="text-muted-foreground hover:text-foreground"
          >
            <LucideHistory className="h-4 w-4" />
            <span className="sr-only">История</span>
          </Button>
        </div>
      )
    }
  ];

  const historyColumns = [
    {
      header: "Действие",
      accessorKey: "action"
    },
    {
      header: "Детали",
      accessorKey: "details"
    },
    {
      header: "Пользователь",
      accessorKey: (row: any) => {
        const user = users.find(u => u.id === row.userId);
        return user 
          ? `${user.lastName || ''} ${user.firstName || ''}`
          : "Система";
      }
    },
    {
      header: "Дата",
      accessorKey: (row: any) => {
        return new Date(row.timestamp).toLocaleString('ru-RU');
      }
    }
  ];

  return (
    <>
      {/* Search Panel */}
      <div className="bg-card rounded-md shadow-sm mb-6">
        <div className="p-4">
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input 
                type="text" 
                placeholder="Поиск по инвентарному номеру" 
                value={searchInventory}
                onChange={(e) => setSearchInventory(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <Input 
                type="text" 
                placeholder="Поиск по ФИО сотрудника" 
                value={searchEmployee}
                onChange={(e) => setSearchEmployee(e.target.value)}
              />
            </div>
            <div className="w-auto">
              <Button 
                variant="secondary" 
                className="h-full"
                onClick={handleSearch}
              >
                <LucideSearch className="h-4 w-4 mr-2" />
                Найти
              </Button>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              Найдено: {equipment.length}
            </div>
            <div className="flex space-x-2">
              <Button 
                onClick={handleOpenAddDialog}
                className="bg-primary text-primary-foreground"
              >
                <LucidePlus className="h-4 w-4 mr-2" />
                Добавить
              </Button>
              <div className="flex space-x-2">
                <Button variant="outline" onClick={() => window.location.href = '/api/equipment/template'}>
                  <LucideDownload className="h-4 w-4 mr-2" />
                  Скачать шаблон
                </Button>
                <label className="cursor-pointer">
                  <Button variant="outline" onClick={() => document.getElementById('fileInput')?.click()}>
                    <LucideUpload className="h-4 w-4 mr-2" />
                    Импорт
                  </Button>
                  <input
                    id="fileInput"
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleFileImport}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Equipment Table */}
      <div className="bg-card rounded-md shadow-sm">
        <DataTable
          data={equipment}
          columns={columns}
          isLoading={isLoading}
          pageSize={10}
          noDataMessage="Имущество не найдено"
        />
      </div>

      {/* Add/Edit Equipment Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedEquipment ? "Редактировать имущество" : "Добавить имущество"}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="inventoryNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Инвентарный номер</FormLabel>
                    <FormControl>
                      <Input placeholder="Например: T-2022-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Наименование</FormLabel>
                    <FormControl>
                      <Input placeholder="Например: HP EliteBook 840 G7" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Тип</FormLabel>
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
                        {EQUIPMENT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
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
                        <SelectItem value={EQUIPMENT_STATUS.ACTIVE}>Активно</SelectItem>
                        <SelectItem value={EQUIPMENT_STATUS.STORAGE}>На складе</SelectItem>
                        <SelectItem value={EQUIPMENT_STATUS.REPAIR}>На ремонте</SelectItem>
                        <SelectItem value={EQUIPMENT_STATUS.DECOMMISSIONED}>Не используется</SelectItem>
                        <SelectItem value={EQUIPMENT_STATUS.WRITTEN_OFF}>Списано</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="assignedToUserId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Закреплено за</FormLabel>
                    <Select
                      value={field.value?.toString() || ""}
                      onValueChange={(value) => 
                        field.onChange(value ? parseInt(value, 10) : null)
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите сотрудника" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="null">Не закреплено</SelectItem>
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
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Описание</FormLabel>
                    <FormControl>
                      <Input placeholder="Дополнительная информация" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="submit" className="w-full">
                  {selectedEquipment ? "Обновить" : "Добавить"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Equipment History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              История имущества: {selectedEquipment?.name} ({selectedEquipment?.inventoryNumber})
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[500px] overflow-y-auto">
            <DataTable
              data={equipmentHistory}
              columns={historyColumns}
              isLoading={isHistoryLoading}
              pageSize={10}
              noDataMessage="История не найдена"
            />
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsHistoryDialogOpen(false)}
            >
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}