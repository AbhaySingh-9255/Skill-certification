import axios from 'axios';

interface GenerateQuizParams {
  subject: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  count: number;
  accessToken: string;
}

interface DraftOption {
  id: string;
  text: string;
}

interface DraftQuestion {
  prompt: string;
  points: number;
  explanation: string;
  options: Array<DraftOption & { isCorrect: boolean }>;
}

interface GenerateQuizResponse {
  source: 'gemini' | 'groq';
  practice_only: true;
  questions: DraftQuestion[];
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000/api';

export const generatePracticeQuiz = async ({
  subject,
  difficulty,
  count,
  accessToken,
}: GenerateQuizParams): Promise<GenerateQuizResponse> => {
  if (!subject.trim()) throw new Error('Enter a topic.');
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error('Question count must be between 1 and 100.');
  }

  try {
    const response = await axios.post<GenerateQuizResponse>(
      `${API_BASE_URL}/practice/questions/generate`,
      { topic: subject, difficulty, count, type: 'mcq' },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const questions = response.data?.questions;
    if (
      !['gemini', 'groq'].includes(response.data?.source ?? '')
      || response.data.practice_only !== true
      || !Array.isArray(questions)
      || questions.length !== count
      || questions.some((question) => (
        !question
        || typeof question.prompt !== 'string'
        || !question.prompt.trim()
        || typeof question.explanation !== 'string'
        || !question.explanation.trim()
        || !Number.isFinite(question.points)
        || question.points <= 0
        || !Array.isArray(question.options)
        || question.options.length !== 4
        || question.options.some((option) => (
          !option
          || typeof option.id !== 'string'
          || typeof option.text !== 'string'
          || !option.text.trim()
          || typeof option.isCorrect !== 'boolean'
        ))
        || question.options.filter((option) => option.isCorrect).length !== 1
      ))
    ) {
      throw new Error('The quiz provider returned an incomplete question set. Please try again.');
    }
    return response.data;
  } catch (error) {
    if (axios.isAxiosError<{ error?: { message?: string } }>(error)) {
      throw new Error(error.response?.data?.error?.message || 'Question generation failed.', {
        cause: error,
      });
    }
    if (error instanceof Error) throw error;
    throw new Error('Question generation failed.', { cause: error });
  }
};
