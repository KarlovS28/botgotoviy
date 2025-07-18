import { apiRequest } from "./queryClient";

// User API functions
export const getUsers = async () => {
  const res = await fetch('/api/users');
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
};

export const updateUserRole = async (userId: number, role: string) => {
  return apiRequest('PATCH', `/api/users/${userId}/role`, { role });
};

export const updateUserPermissions = async (userId: number, permissions: Record<string, boolean>) => {
  return apiRequest('PATCH', `/api/users/${userId}/permissions`, { permissions });
};

export const deleteUser = async (userId: number) => {
  return apiRequest('DELETE', `/api/users/${userId}`);
};

// Equipment API functions
export const getEquipment = async (searchParams?: { inventoryNumber?: string, employeeName?: string }) => {
  const queryString = searchParams ? 
    '?' + new URLSearchParams(searchParams as Record<string, string>).toString() : '';
  
  const res = await fetch(`/api/equipment${queryString}`);
  if (!res.ok) throw new Error('Failed to fetch equipment');
  return res.json();
};

export const addEquipment = async (data: any) => {
  return apiRequest('POST', '/api/equipment', data);
};

export const updateEquipment = async (id: number, data: any) => {
  return apiRequest('PATCH', `/api/equipment/${id}`, data);
};

export const getEquipmentHistory = async (equipmentId: number) => {
  const res = await fetch(`/api/equipment/${equipmentId}/history`);
  if (!res.ok) throw new Error('Failed to fetch equipment history');
  return res.json();
};

// Task API functions
export const getTasks = async (status?: string) => {
  const queryString = status ? `?status=${status}` : '';
  const res = await fetch(`/api/tasks${queryString}`);
  if (!res.ok) throw new Error('Failed to fetch tasks');
  return res.json();
};

export const createTask = async (data: any) => {
  return apiRequest('POST', '/api/tasks', data);
};

export const updateTaskStatus = async (taskId: number, status: string) => {
  return apiRequest('PATCH', `/api/tasks/${taskId}`, { status });
};

export const assignTask = async (taskId: number, userId: number) => {
  return apiRequest('PATCH', `/api/tasks/${taskId}/assign`, { userId });
};

// Secure password API functions
export const getSecurePasswords = async () => {
  const res = await fetch('/api/secure-passwords');
  if (!res.ok) throw new Error('Failed to fetch secure passwords');
  return res.json();
};

export const createSecurePassword = async (data: any) => {
  return apiRequest('POST', '/api/secure-passwords', data);
};

export const markPasswordAsRead = async (passwordId: number) => {
  return apiRequest('PATCH', `/api/secure-passwords/${passwordId}/read`, {});
};

// Bot settings API functions
export const getBotSettings = async () => {
  const res = await fetch('/api/bot-settings');
  if (!res.ok) throw new Error('Failed to fetch bot settings');
  return res.json();
};

export const updateBotSettings = async (settings: Record<string, any>) => {
  return apiRequest('PATCH', '/api/bot-settings', settings);
};

// Auth
export const login = async (username: string, password: string) => {
  return apiRequest('POST', '/api/auth/login', { username, password });
};

export const logout = async () => {
  return apiRequest('POST', '/api/auth/logout', {});
};

export const getCurrentUser = async () => {
  const res = await fetch('/api/auth/me');
  if (res.status === 401) return null;
  if (!res.ok) throw new Error('Failed to fetch current user');
  return res.json();
};
