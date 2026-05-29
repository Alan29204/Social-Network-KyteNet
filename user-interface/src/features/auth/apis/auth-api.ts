import AXIOS_INSTANCE from '@/services/apis/axios-client';
import { useMutation } from '@tanstack/react-query';

export const authApi = {
  login: async (data: any) => {
    const res = await AXIOS_INSTANCE.post('/auth/login', data);
    return res.data;
  },
  register: async (data: any) => {
    const res = await AXIOS_INSTANCE.post('/auth/register', data);
    return res.data;
  },
};

export const useLogin = () => {
  return useMutation({
    mutationFn: authApi.login,
  });
};

export const useRegister = () => {
  return useMutation({
    mutationFn: authApi.register,
  });
};
