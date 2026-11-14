import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000/api';

export interface NotificationPreferences {
  email_notifications_enabled: boolean;
  in_app_notifications_enabled: boolean;
}

export interface PrivacyPreferences {
  share_usage_data: boolean;
}

const requestConfig = (token: string) => ({
  headers: { Authorization: `Bearer ${token}` },
});

export const settingsError = (error: unknown, fallback: string): Error => {
  if (axios.isAxiosError<{ error?: { message?: string } }>(error)) {
    const message = error.response?.data?.error?.message;
    if (message) return new Error(message, { cause: error });
    if (!error.response) {
      return new Error('Cannot reach the API. Check that the backend is running.', { cause: error });
    }
  }
  return error instanceof Error ? error : new Error(fallback, { cause: error });
};

export const fetchNotificationPreferences = async (token: string) => {
  try {
    const response = await axios.get<NotificationPreferences>(
      `${API_BASE_URL}/settings/notifications`,
      requestConfig(token),
    );
    return response.data;
  } catch (error) {
    throw settingsError(error, 'Could not load notification preferences.');
  }
};

export const saveNotificationPreferences = async (
  token: string,
  preferences: NotificationPreferences,
) => {
  try {
    const response = await axios.put<NotificationPreferences>(
      `${API_BASE_URL}/settings/notifications`,
      preferences,
      requestConfig(token),
    );
    return response.data;
  } catch (error) {
    throw settingsError(error, 'Could not save notification preferences.');
  }
};

export const fetchPrivacyPreferences = async (token: string) => {
  try {
    const response = await axios.get<PrivacyPreferences>(
      `${API_BASE_URL}/settings/privacy`,
      requestConfig(token),
    );
    return response.data;
  } catch (error) {
    throw settingsError(error, 'Could not load privacy preferences.');
  }
};

export const savePrivacyPreferences = async (token: string, preferences: PrivacyPreferences) => {
  try {
    const response = await axios.put<PrivacyPreferences>(
      `${API_BASE_URL}/settings/privacy`,
      preferences,
      requestConfig(token),
    );
    return response.data;
  } catch (error) {
    throw settingsError(error, 'Could not save privacy preferences.');
  }
};

export const downloadAccountData = async (token: string) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/account/export`, {
      ...requestConfig(token),
      responseType: 'blob',
    });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'skillcert-account-data.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    throw settingsError(error, 'Could not export account data.');
  }
};

export const deleteAccountRequest = async (token: string, currentPassword: string) => {
  try {
    await axios.delete(`${API_BASE_URL}/account`, {
      ...requestConfig(token),
      data: { current_password: currentPassword, confirmation: 'DELETE' },
    });
  } catch (error) {
    throw settingsError(error, 'Could not delete the account.');
  }
};
