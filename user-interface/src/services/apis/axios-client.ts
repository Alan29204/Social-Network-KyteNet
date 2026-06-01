import axios, { AxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/features/auth/stores/auth-store';

const AXIOS_INSTANCE = axios.create({
  baseURL: 'http://localhost:3000', // core-api url
});

AXIOS_INSTANCE.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

AXIOS_INSTANCE.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Handle 401 and refresh token logic here if needed
    if (error.response?.status === 401 && !error.config?.url?.includes('/login')) {
      const { logout } = useAuthStore.getState();
      logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const orvalClient = <T>(
  config: string | AxiosRequestConfig,
  options?: any
): Promise<T> => {
  const source = axios.CancelToken.source();
  
  let axiosConfig: AxiosRequestConfig;
  
  if (typeof config === 'string') {
    const { body, ...restOptions } = options || {};
    axiosConfig = {
      url: config,
      method: restOptions.method || 'GET',
      data: body || restOptions.data,
      headers: restOptions.headers,
      ...restOptions,
    };
  } else {
    axiosConfig = {
      ...config,
      ...options,
    };
  }

  console.log('AXIOS_REQUEST:', axiosConfig);

  const promise = AXIOS_INSTANCE({
    ...axiosConfig,
    cancelToken: source.token,
  }).then(({ data }) => data);

  // @ts-ignore
  promise.cancel = () => {
    source.cancel('Query was cancelled');
  };

  return promise;
};

export default AXIOS_INSTANCE;
