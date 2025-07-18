import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { getBotSettings, updateBotSettings } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

const settingsFormSchema = z.object({
  botToken: z.string().min(1, "Токен бота обязателен"),
  welcomeMessage: z.string().min(1, "Приветственное сообщение обязательно"),
  equipmentChatId: z.string().optional(),
  passwordsChatId: z.string().optional(),
  tasksChatId: z.string().optional(),
  adminUsernames: z.string().optional()
});

export default function Settings() {
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof settingsFormSchema>>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      botToken: "",
      welcomeMessage: "Добро пожаловать в бота управления имуществом, паролями и задачами. Выберите роль, чтобы продолжить.",
      equipmentChatId: "",
      passwordsChatId: "",
      tasksChatId: "",
      adminUsernames: ""
    }
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      setIsLoading(true);
      const settings = await getBotSettings();
      
      if (settings) {
        form.reset({
          botToken: settings.botToken || "",
          welcomeMessage: settings.welcomeMessage || "Добро пожаловать в бота управления имуществом, паролями и задачами. Выберите роль, чтобы продолжить.",
          equipmentChatId: settings.equipmentChatId || "",
          passwordsChatId: settings.passwordsChatId || "",
          tasksChatId: settings.tasksChatId || "",
          adminUsernames: settings.adminUsernames ? settings.adminUsernames.join(", ") : ""
        });
      }
    } catch (error) {
      console.error("Failed to fetch bot settings:", error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось загрузить настройки бота"
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function onSubmit(values: z.infer<typeof settingsFormSchema>) {
    try {
      // Process adminUsernames to convert string to array
      const adminUsernames = values.adminUsernames 
        ? values.adminUsernames.split(",").map(username => username.trim())
        : [];
      
      await updateBotSettings({
        ...values,
        adminUsernames
      });
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['/api/bot-settings'] });
      
      toast({
        title: "Успешно",
        description: "Настройки бота сохранены"
      });
    } catch (error) {
      console.error("Failed to update bot settings:", error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось сохранить настройки бота"
      });
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="h-6 bg-muted animate-pulse rounded-md w-1/3"></CardTitle>
          <CardDescription className="h-4 bg-muted animate-pulse rounded-md w-2/3"></CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 bg-muted animate-pulse rounded-md w-1/4"></div>
              <div className="h-10 bg-muted animate-pulse rounded-md w-full"></div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Настройки Telegram бота</CardTitle>
        <CardDescription>
          Настройте параметры вашего Telegram бота для управления имуществом, паролями и задачами.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="botToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Токен бота</FormLabel>
                    <FormControl>
                      <Input placeholder="Введите токен Telegram бота" {...field} />
                    </FormControl>
                    <FormDescription>
                      Получите токен бота у @BotFather в Telegram
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="welcomeMessage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Приветственное сообщение</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Введите приветственное сообщение бота" 
                        rows={3}
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Сообщение, которое будет отправлено пользователю при первом запуске бота
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="equipmentChatId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID чата "Мат.ответственность"</FormLabel>
                    <FormControl>
                      <Input placeholder="Например: -1001234567890" {...field} />
                    </FormControl>
                    <FormDescription>
                      ID группового чата для управления имуществом
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="passwordsChatId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID чата "Пароли"</FormLabel>
                    <FormControl>
                      <Input placeholder="Например: -1001234567890" {...field} />
                    </FormControl>
                    <FormDescription>
                      ID группового чата для безопасного обмена паролями
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="tasksChatId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID чата "Задачи"</FormLabel>
                    <FormControl>
                      <Input placeholder="Например: -1001234567890" {...field} />
                    </FormControl>
                    <FormDescription>
                      ID группового чата для управления задачами
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="adminUsernames"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Администраторы бота</FormLabel>
                    <FormControl>
                      <Input placeholder="username1, username2, username3" {...field} />
                    </FormControl>
                    <FormDescription>
                      Списоуа пользвателей Telegram, которые будут иметь доступ к административной панели (через запятую)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <Button type="submit">Сохранить настройки</Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="border-t pt-6 flex flex-col items-start">
        <h3 className="text-sm font-medium mb-2">Перезапуск бота</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Если вы изменили токен бота или другие важные настройки, необходимо перезапустить бота.
        </p>
        <Button variant="outline">Перезапустить бота</Button>
      </CardFooter>
    </Card>
  );
}
