import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000/api';

export const fetchCategories = async (): Promise<string[]> => {
  try {
    const response = await axios.get<{ items: unknown }>(`${API_BASE_URL}/categories`);
    if (
      !Array.isArray(response.data.items)
      || response.data.items.some((category) => typeof category !== 'string')
    ) {
      throw new Error('The categories service returned an invalid response.');
    }
    return response.data.items;
  } catch (error) {
    if (axios.isAxiosError<{ error?: { message?: string } }>(error)) {
      throw new Error(
        error.response?.data?.error?.message || 'Could not load topic suggestions.',
        { cause: error },
      );
    }
    if (error instanceof Error) throw error;
    throw new Error('Could not load topic suggestions.', { cause: error });
  }
};
