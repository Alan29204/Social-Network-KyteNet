import AXIOS_INSTANCE from '@/services/apis/axios-client';
import { useMutation } from '@tanstack/react-query';

export const authApi = {
  login: async (data: any) => {
    const res = await AXIOS_INSTANCE.post('/users/login', data);
    return res.data;
  },
  register: async (data: any) => {
    const res = await AXIOS_INSTANCE.post('/users/signup', data);
    return res.data;
  },
  sendRegisterOtp: async (email: string) => {
    const res = await AXIOS_INSTANCE.post('/users/register/send-otp', { email });
    return res.data;
  },
  forgotPassword: async (email: string) => {
    const res = await AXIOS_INSTANCE.post('/users/forgot-password', { email });
    return res.data;
  },
  resetPassword: async (data: {
    email: string;
    reset_code: string;
    new_password: string;
  }) => {
    const res = await AXIOS_INSTANCE.post('/users/reset-password', data);
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

export const useSendRegisterOtp = () => {
  return useMutation({
    mutationFn: authApi.sendRegisterOtp,
  });
};

export const useForgotPassword = () => {
  return useMutation({
    mutationFn: authApi.forgotPassword,
  });
};

export const useResetPassword = () => {
  return useMutation({
    mutationFn: authApi.resetPassword,
  });
};
