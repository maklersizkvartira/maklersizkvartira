'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@/i18n/routing';
import { faceLogin } from '../api';
import { useAuthStore } from '@/store/auth.store';

export function useFaceLogin() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: (image: string) => faceLogin(image),
    onSuccess: async (result) => {
      queryClient.clear();
      setAuth(result.admin, result.accessToken);

      await fetch('/api/auth/set-refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: result.refreshToken }),
      });

      router.replace('/dashboard');
    },
  });
}
