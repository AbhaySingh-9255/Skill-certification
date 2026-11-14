import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000/api';

export interface PracticeHistoryEntry {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  question_count: number;
  score_percent: number;
  passed: boolean;
  submitted_at: string;
}

export interface AssessmentHistoryEntry {
  id: number;
  title?: string;
  category?: string;
  status: string;
  score_percent: number | null;
  passed: boolean | null;
  submitted_at: number | null;
  time_taken_seconds: number;
  certificate_id?: string | null;
}

interface ResultsResponse {
  items: AssessmentHistoryEntry[];
  total: number;
}

const storageKey = (userId: string) => `skillcert-practice-history:${userId}`;

const isPracticeHistoryEntry = (entry: unknown): entry is PracticeHistoryEntry => (
  typeof entry === 'object'
  && entry !== null
  && 'id' in entry
  && typeof entry.id === 'string'
  && 'title' in entry
  && typeof entry.title === 'string'
  && 'category' in entry
  && typeof entry.category === 'string'
  && 'difficulty' in entry
  && typeof entry.difficulty === 'string'
  && 'question_count' in entry
  && Number.isInteger(entry.question_count)
  && 'score_percent' in entry
  && typeof entry.score_percent === 'number'
  && Number.isFinite(entry.score_percent)
  && entry.score_percent >= 0
  && entry.score_percent <= 100
  && 'passed' in entry
  && typeof entry.passed === 'boolean'
  && 'submitted_at' in entry
  && typeof entry.submitted_at === 'string'
  && !Number.isNaN(Date.parse(entry.submitted_at))
);

export const loadPracticeHistory = (userId: string): PracticeHistoryEntry[] => {
  try {
    const stored = window.localStorage.getItem(storageKey(userId));
    if (!stored) return [];
    const entries: unknown = JSON.parse(stored);
    if (!Array.isArray(entries) || !entries.every(isPracticeHistoryEntry)) {
      throw new Error('Saved practice history has an invalid format.');
    }
    return entries;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Saved practice history could not be read. Clear this browser’s site data to reset it.', {
        cause: error,
      });
    }
    if (error instanceof Error) throw error;
    throw new Error('Saved practice history could not be read.', { cause: error });
  }
};

export const savePracticeHistoryEntry = (
  userId: string,
  entry: PracticeHistoryEntry,
): void => {
  const entries = loadPracticeHistory(userId);
  const nextEntries = [
    entry,
    ...entries.filter((existing) => existing.id !== entry.id),
  ];

  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(nextEntries));
  } catch (error) {
    throw new Error('This browser could not save your practice history.', { cause: error });
  }
};

export const fetchAssessmentHistory = async (token: string): Promise<ResultsResponse> => {
  try {
    const response = await axios.get<ResultsResponse>(`${API_BASE_URL}/results`, {
      params: { page: 1, per_page: 100 },
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!Array.isArray(response.data.items) || typeof response.data.total !== 'number') {
      throw new Error('The assessment history service returned an invalid response.');
    }
    return response.data;
  } catch (error) {
    if (axios.isAxiosError<{ error?: { message?: string } }>(error)) {
      throw new Error(
        error.response?.data?.error?.message || 'Could not load assessment history.',
        { cause: error },
      );
    }
    if (error instanceof Error) throw error;
    throw new Error('Could not load assessment history.', { cause: error });
  }
};
