// src/types.ts

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  prompt: string;
  options: QuestionOption[];
  points: number;
}

export interface Assessment {
  id: string;
  title: string;
  durationMinutes: number;
  questions: Question[];
}

export interface ViolationLog {
  timestamp: number;
  type: 'TAB_SWITCH' | 'BLUR' | 'FULLSCREEN_EXIT';
  detail: string;
}