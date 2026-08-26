import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';

export interface UserSession {
  id: number;
  code: string;
  username: string;
  role: 'ADMIN' | 'MANAGER' | 'CASHIER';
  is_active: number;
}

export function useSession() {
  return useQuery<UserSession | null>({
    queryKey: ['auth', 'session'],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.AUTH.GET_SESSION);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (credentials: { username: string; passwordPlain: string }) => {
      const res = await window.api.invoke(IPC_CHANNELS.AUTH.LOGIN, {
        username: credentials.username,
        password: credentials.passwordPlain,
      });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['auth', 'session'], data);
      queryClient.invalidateQueries(); // Clear any cached queries from previous sessions
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.AUTH.LOGOUT);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'session'], null);
      queryClient.invalidateQueries();
    },
  });
}
