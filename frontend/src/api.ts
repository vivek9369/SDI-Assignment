import axios from 'axios';
import Cookie from 'js-cookie';
import { API_BASE_URL } from '@/config.ts';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface ScheduledEmail {
  id: string;
  recipientEmail: string;
  subject: string;
  scheduledTime: string;
  status: string;
  sender: {
    name: string;
    email: string;
  };
}

export interface SentEmail {
  id: string;
  recipientEmail: string;
  subject: string;
  sentTime?: string;
  status: string;
  failureReason?: string;
  sender: {
    name: string;
    email: string;
  };
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

const createAxiosInstance = () => {
  return axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

export const apiClient = {
  async googleLogin(userData: any) {
    const api = createAxiosInstance();
    const response = await api.post('/auth/google-login', userData);
    if (response.data.token) {
      Cookie.set('auth_token', response.data.token);
      Cookie.set('user_id', response.data.user.id);
    }
    return response.data;
  },

  async getProfile() {
    const api = createAxiosInstance();
    const userId = Cookie.get('user_id');
    const response = await api.get('/auth/profile', {
      headers: { 'x-user-id': userId },
    });
    return response.data;
  },

  async scheduleEmails(params: {
    subject: string;
    body: string;
    recipients: string[];
    startTime: Date;
    delayMs: number;
    hourlyLimit: number;
    senderEmail: string;
    senderName: string;
  }) {
    const api = createAxiosInstance();
    const userId = Cookie.get('user_id');
    const response = await api.post('/emails/schedule', params, {
      headers: { 'x-user-id': userId },
    });
    return response.data;
  },

  async getScheduledEmails(page = 1, limit = 20) {
    const api = createAxiosInstance();
    const userId = Cookie.get('user_id');
    const response = await api.get(`/emails/scheduled?page=${page}&limit=${limit}`, {
      headers: { 'x-user-id': userId },
    });
    return response.data;
  },

  async getSentEmails(page = 1, limit = 20) {
    const api = createAxiosInstance();
    const userId = Cookie.get('user_id');
    const response = await api.get(`/emails/sent?page=${page}&limit=${limit}`, {
      headers: { 'x-user-id': userId },
    });
    return response.data;
  },

  async getStats() {
    const api = createAxiosInstance();
    const userId = Cookie.get('user_id');
    const response = await api.get('/emails/stats', {
      headers: { 'x-user-id': userId },
    });
    return response.data;
  },
};
