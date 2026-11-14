import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Code2,
  Gauge,
  Hash,
  ListChecks,
  LogOut,
  ShieldAlert,
  Settings,
  Sparkles,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/Button';
import { Certificate } from '../components/Certificate';
import { SettingsDialog } from '../components/SettingsDialog';
import { PracticeHistory } from '../components/PracticeHistory';
import { QuizEngine } from '../components/assessment/QuizEngine';
import { generatePracticeQuiz } from '../services/aiQuizService';
import { fetchCategories } from '../services/categoryService';
import { savePracticeHistoryEntry } from '../services/historyService';
import type { ViolationLog } from '../types';

type Level = 'Beginner' | 'Intermediate' | 'Advanced';

const LEVELS: Level[] = ['Beginner', 'Intermediate', 'Advanced'];
const DEFAULT_COUNT = 10;
const MAX_QUESTION_COUNT = 100;
const MAX_QUIZ_DURATION_MINUTES = 180;
const PRESET_COUNTS = [5, 10, 20, 50] as const;

const estimateDurationMinutes = (count: number) => Math.max(5, Math.ceil(count / 2));

type GeneratedAssessment = {
  title: string;
  description: string;
  difficulty: Level;
  durationMinutes: number;
  questions: Array<{
    id: string;
    prompt: string;
    explanation: string;
    points: number;
    options: Array<{ id: string; text: string; isCorrect: boolean }>;
  }>;
};

export const DashboardPage = () => {
  const { user, token, logout } = useAuthStore();
  const [viewState, setViewState] = useState<'idle' | 'taking-test' | 'completed'>('idle');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState('');
  const [categoryRetry, setCategoryRetry] = useState(0);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [difficulty, setDifficulty] = useState<Level>('Beginner');
  const [questionCount, setQuestionCount] = useState<number>(DEFAULT_COUNT);
  const [durationMinutes, setDurationMinutes] = useState<number>(
    estimateDurationMinutes(DEFAULT_COUNT),
  );
  const [customCountSelected, setCustomCountSelected] = useState(false);
  const [assessment, setAssessment] = useState<GeneratedAssessment | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [fullscreenError, setFullscreenError] = useState('');
  const [historySaveError, setHistorySaveError] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    passed: boolean;
    violations: ViolationLog[];
    answers: Record<string, string>;
  } | null>(null);

  useEffect(() => {
    let active = true;
    fetchCategories()
      .then((loadedCategories) => {
        if (!active) return;
        setCategories(loadedCategories);
      })
      .catch((error: unknown) => {
        if (active) {
          setCategoriesError(
            error instanceof Error ? error.message : 'Could not load topic suggestions.',
          );
        }
      })
      .finally(() => {
        if (active) setCategoriesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [categoryRetry]);

  const matchingCategories = selectedSubject.trim()
    ? categories.filter((category) => category.toLowerCase().includes(selectedSubject.trim().toLowerCase()))
    : categories;
  const visibleCategories = showAllCategories
    ? matchingCategories
    : matchingCategories.slice(0, 5);

  const handleGenerateAssessment = async (): Promise<GeneratedAssessment | null> => {
    if (!token) {
      setGenerationError('Your sign-in session is missing. Sign in again to generate a practice quiz.');
      return null;
    }
    if (!selectedSubject.trim()) {
      setGenerationError('Enter a technical subject or programming language.');
      return null;
    }
    if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > MAX_QUESTION_COUNT) {
      setGenerationError('Choose between 1 and 100 questions.');
      return null;
    }

    setGenerating(true);
    setGenerationError('');
    setAssessment(null);
    setViewState('idle');
    setResult(null);
    try {
      const generated = await generatePracticeQuiz({
        subject: selectedSubject.trim(),
        difficulty,
        count: questionCount,
        accessToken: token,
      });
      const timestamp = Date.now();
      const nextAssessment: GeneratedAssessment = {
        title: `${selectedSubject.trim()} ${difficulty} Practice Quiz`,
        description: `A fresh set of AI-generated questions for ${selectedSubject.trim()} at ${difficulty} level.`,
        durationMinutes,
        difficulty,
        questions: generated.questions.map((question, questionIndex) => ({
          id: `practice-${timestamp}-${questionIndex}`,
          prompt: question.prompt,
          explanation: question.explanation,
          points: question.points,
          options: question.options.map((option) => ({
            id: option.id,
            text: option.text,
            isCorrect: option.isCorrect,
          })),
        })),
      };
      setAssessment(nextAssessment);
      return nextAssessment;
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Question generation failed.');
      return null;
    } finally {
      setGenerating(false);
    }
  };

  const handleStartTest = async () => {
    setFullscreenError('');
    if (!document.fullscreenElement) {
      if (!document.fullscreenEnabled || !document.documentElement.requestFullscreen) {
        setFullscreenError('Fullscreen is unavailable in this browser. The quiz will still start.');
      } else {
        try {
          void document.documentElement.requestFullscreen().catch(() => {
            setFullscreenError('Fullscreen could not be enabled. The quiz will still start.');
          });
        } catch {
          setFullscreenError('Fullscreen could not be enabled. The quiz will still start.');
        }
      }
    }

    const nextAssessment = assessment ?? await handleGenerateAssessment();
    if (!nextAssessment) {
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {
          setFullscreenError('Fullscreen could not be exited after quiz setup failed. Press Esc to exit.');
        });
      }
      return;
    }
    setAssessment(nextAssessment);
    setViewState('taking-test');
  };

  const exitQuizFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {
        setFullscreenError('The quiz ended, but fullscreen could not be exited. Press Esc to exit.');
      });
    }
  };

  const handleComplete = (
    score: number,
    passed: boolean,
    violations: ViolationLog[],
    answers: Record<string, string>,
  ) => {
    exitQuizFullscreen();
    if (user) {
      try {
        savePracticeHistoryEntry(user.id, {
          id: `${Date.now()}-${assessment?.title ?? 'practice'}`,
          title: assessment?.title ?? 'Practice quiz',
          category: selectedSubject.trim() || 'General practice',
          difficulty,
          question_count: assessment?.questions.length ?? 0,
          score_percent: score,
          passed,
          submitted_at: new Date().toISOString(),
        });
        setHistorySaveError('');
      } catch (error) {
        setHistorySaveError(
          error instanceof Error ? error.message : 'Your practice result could not be saved to this browser.',
        );
      }
    }
    setResult({ score, passed, violations, answers });
    setViewState('completed');
  };

  const handleLeaveQuiz = () => {
    exitQuizFullscreen();
    setResult(null);
    setViewState('idle');
  };

  const handleReset = () => {
    setViewState('idle');
    setResult(null);
  };

  if (viewState === 'taking-test' && assessment) {
    return (
      <QuizEngine
        title={assessment.title}
        durationMinutes={assessment.durationMinutes}
        questions={assessment.questions}
        onComplete={handleComplete}
        onLeave={handleLeaveQuiz}
        fullscreenWarning={fullscreenError}
        onFullscreenError={setFullscreenError}
      />
    );
  }

  if (viewState === 'completed' && result && assessment) {
    return (
      <div className="min-h-screen bg-slateBg flex items-center justify-center p-4">
        <div className="max-w-3xl w-full space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-textMuted">Practice complete</p>
            <h1 className="mt-2 text-3xl font-bold text-navy">{result.score}%</h1>
            <p className="mt-2 text-textMuted">
              {result.passed ? 'Great work!' : 'Keep practicing!'} You answered{' '}
              {assessment.questions.filter((question) => (
                question.options.find((option) => option.isCorrect)?.id === result.answers[question.id]
              )).length} of {assessment.questions.length} questions correctly.
            </p>
            <p className="mt-3 text-xs text-gray-500">
              This practice result is not an accredited or independently verified qualification.
            </p>
            {result.violations.length > 0 && (
              <p className="mt-3 text-sm text-orange-600">
                {result.violations.length} focus warning(s) were recorded during this practice session.
              </p>
            )}
            {historySaveError && (
              <p role="alert" className="mt-3 text-sm text-red-700">{historySaveError}</p>
            )}
          </section>

          {result.passed && (
            <Certificate
              userName={user?.name || 'Learner'}
              courseTitle={assessment.title}
              score={result.score}
              passed={result.passed}
              questionCount={assessment.questions.length}
            />
          )}

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-navy">Answer review</h2>
            {assessment.questions.map((question, index) => {
              const correctOption = question.options.find((option) => option.isCorrect);
              const selectedOption = question.options.find(
                (option) => option.id === result.answers[question.id],
              );
              const wasCorrect = selectedOption?.isCorrect === true;

              return (
                <article key={question.id} className="rounded-xl border border-gray-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-textMuted">
                    Question {index + 1} · {wasCorrect ? 'Correct' : 'Review this answer'}
                  </p>
                  <h3 className="mt-2 font-semibold text-navy">{question.prompt}</h3>
                  <p className="mt-3 text-sm text-gray-700">
                    Your answer: {selectedOption?.text ?? 'Not answered'}
                  </p>
                  {!wasCorrect && (
                    <p className="mt-1 text-sm text-green-700">
                      Correct answer: {correctOption?.text ?? 'Unavailable'}
                    </p>
                  )}
                  <p className="mt-3 border-t border-gray-100 pt-3 text-sm text-textMuted">
                    {question.explanation}
                  </p>
                </article>
              );
            })}
          </section>

          <div className="text-center">
            <Button variant="secondary" onClick={handleReset}>
              Return to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slateBg px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3" aria-label="SkillCert Pro dashboard">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-navy">
              <BookOpen size={22} aria-hidden="true" />
            </span>
            <span>
              <span className="block text-lg font-bold leading-tight text-navy">SkillCert Pro</span>
              <span className="block text-xs text-textMuted">Practice dashboard</span>
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="secondary"
              onClick={() => setSettingsOpen(true)}
              className="h-10 w-10 rounded-xl p-0"
              aria-haspopup="dialog"
              aria-label="Open account settings"
              title="Account settings"
            >
              <Settings size={18} aria-hidden="true" />
            </Button>
            <details className="group relative">
              <summary
                aria-label="Open account menu"
                className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-gray-200 bg-white py-1.5 pl-1.5 pr-2.5 transition-colors hover:bg-slateBg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal [&::-webkit-details-marker]:hidden"
              >
                {user?.profilePhoto ? (
                  <img
                    src={user.profilePhoto}
                    alt=""
                    className="h-8 w-8 rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#245B4A] text-xs font-semibold text-white">
                    {user?.name?.trim().charAt(0).toUpperCase() || 'U'}
                  </span>
                )}
                <span className="hidden max-w-36 text-left sm:block">
                  <span className="block text-xs text-textMuted">Signed in as</span>
                  <span className="block truncate text-sm font-medium text-navy">{user?.name}</span>
                </span>
                <ChevronDown
                  size={15}
                  aria-hidden="true"
                  className="hidden text-textMuted sm:block"
                />
              </summary>
              <div className="absolute right-0 top-full z-30 mt-2 w-48 rounded-xl border border-gray-200 bg-white p-1.5">
                <Button
                  variant="secondary"
                  onClick={logout}
                  className="w-full justify-start gap-2 border-0 px-3 text-textMuted hover:bg-slateBg hover:text-navy"
                >
                  <LogOut size={16} aria-hidden="true" />
                  Sign out
                </Button>
              </div>
            </details>
          </div>
        </header>

        <div className="grid gap-6">
          {assessment ? (
            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <div className="border-b border-gray-200 bg-slateBg px-6 py-8 text-navy sm:px-10 sm:py-10">
                <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm font-semibold text-textMuted">
                  <CheckCircle2 size={18} className="text-textMuted" aria-hidden="true" />
                  Your quiz is ready
                </div>
                <h2 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
                  {assessment.title}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-textMuted sm:text-base">
                  {assessment.description}
                </p>
              </div>

              <div className="p-6 sm:p-10">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl border border-gray-200 bg-white p-5">
                    <ListChecks className="mb-3 text-textMuted" size={22} aria-hidden="true" />
                    <p className="text-2xl font-bold text-navy">{assessment.questions.length}</p>
                    <p className="mt-1 text-sm text-textMuted">Questions</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-5">
                    <Sparkles className="mb-3 text-textMuted" size={22} aria-hidden="true" />
                    <p className="text-2xl font-bold text-navy">{assessment.difficulty}</p>
                    <p className="mt-1 text-sm text-textMuted">Difficulty</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-5">
                    <Clock3 className="mb-3 text-textMuted" size={22} aria-hidden="true" />
                    <p className="text-2xl font-bold text-navy">~{assessment.durationMinutes} min</p>
                    <p className="mt-1 text-sm text-textMuted">Estimated time</p>
                  </div>
                </div>

                <div className="mt-6 flex items-start gap-3 rounded-xl border border-[#D8DED8] bg-slateBg p-4">
                  <ShieldAlert className="mt-0.5 shrink-0 text-brass" size={20} aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-navy">Before you begin</p>
                    <p className="mt-1 text-sm leading-5 text-textMuted">
                      You need 70% to pass. The quiz requests fullscreen and records focus changes.
                      Browser extensions cannot be disabled by this website.
                    </p>
                  </div>
                </div>

                {fullscreenError && (
                  <p role="status" className="mt-4 text-sm text-orange-700">{fullscreenError}</p>
                )}

                <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setAssessment(null);
                      setGenerationError('');
                      setFullscreenError('');
                    }}
                    className="gap-2"
                  >
                    <ArrowLeft size={16} aria-hidden="true" />
                    Edit settings
                  </Button>
                  <Button
                    type="button"
                    variant="accent"
                    onClick={() => void handleStartTest()}
                    className="px-8 py-3 text-base"
                  >
                    Start Quiz
                  </Button>
                </div>
              </div>
            </section>
          ) : (
            <section className="space-y-7">
              <header className="max-w-3xl">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#D8DED8] bg-white px-3 py-1.5 text-xs font-semibold tracking-wide text-[#245B4A]">
                  <Sparkles size={14} aria-hidden="true" />
                  Personalized practice
                </span>
                <h1 className="mt-4 text-3xl font-bold tracking-tight text-navy sm:text-4xl">
                  Build your next skill.
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-textMuted sm:text-base">
                  Create a focused practice quiz around a topic and challenge level that suit your goals.
                </p>
              </header>

              <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
                <div className="rounded-2xl border border-line bg-white p-5 sm:p-8">
                  <div className="mb-7 flex items-center justify-between border-b border-line pb-5">
                    <div>
                      <h2 className="text-lg font-semibold text-navy">Configure your quiz</h2>
                      <p className="mt-1 text-sm text-textMuted">Set up three simple details to get started.</p>
                    </div>
                    <span className="hidden rounded-full bg-slateBg px-3 py-1 text-xs font-medium text-textMuted sm:inline-flex">
                      Takes about 1 minute
                    </span>
                  </div>

                  <div className="space-y-8">
                    <div>
                      <label htmlFor="quiz-subject" className="mb-2 flex items-center gap-2 text-sm font-semibold text-navy">
                        <Code2 size={17} className="text-textMuted" aria-hidden="true" />
                        Topic
                      </label>
                      <input
                        id="quiz-subject"
                        type="text"
                        value={selectedSubject}
                        list="quiz-topic-options"
                        maxLength={160}
                        aria-describedby="quiz-topic-help"
                        onChange={(event) => {
                          setSelectedSubject(event.target.value);
                          setAssessment(null);
                          setResult(null);
                          setGenerationError('');
                        }}
                        placeholder="Search or enter a topic"
                        className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-navy outline-none transition-colors placeholder:text-textMuted/80 hover:border-[#9EAEA4] focus:border-[#245B4A] focus:ring-2 focus:ring-[#245B4A]/15"
                      />
                      <datalist id="quiz-topic-options">
                        {categories.map((category) => <option key={category} value={category} />)}
                      </datalist>
                      <p id="quiz-topic-help" className="mt-2 text-sm text-textMuted">
                        Choose a suggestion or enter your own technical topic.
                      </p>

                      {categoriesLoading ? (
                        <p role="status" className="mt-3 text-xs text-textMuted">Loading topic suggestions…</p>
                      ) : categoriesError ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-textMuted">
                          <span>{categoriesError} You can still enter a topic.</span>
                          <button
                            type="button"
                            onClick={() => {
                              setCategoriesError('');
                              setCategoriesLoading(true);
                              setCategoryRetry((attempt) => attempt + 1);
                            }}
                            className="font-semibold text-[#245B4A] underline underline-offset-2 hover:text-[#194638] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245B4A]"
                          >
                            Try again
                          </button>
                        </div>
                      ) : matchingCategories.length > 0 ? (
                        <div className="mt-4">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-textMuted">
                              Suggested topics ({matchingCategories.length})
                            </p>
                            <div className="flex items-center gap-3">
                              {matchingCategories.length > 5 && (
                                <button
                                  type="button"
                                  onClick={() => setShowAllCategories((shown) => !shown)}
                                  aria-expanded={showAllCategories}
                                  className="text-xs font-semibold text-[#245B4A] underline underline-offset-2 hover:text-[#194638] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245B4A]"
                                >
                                  {showAllCategories ? 'Show fewer' : 'Show all'}
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={categoriesLoading}
                                onClick={() => {
                                  setCategoriesError('');
                                  setCategoriesLoading(true);
                                  setCategoryRetry((attempt) => attempt + 1);
                                }}
                                className="text-xs font-semibold text-[#245B4A] underline underline-offset-2 hover:text-[#194638] disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245B4A]"
                              >
                                Refresh topics
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {visibleCategories.map((category) => (
                              <button
                                key={category}
                                type="button"
                                onClick={() => {
                                  setSelectedSubject(category);
                                  setAssessment(null);
                                  setResult(null);
                                  setGenerationError('');
                                }}
                                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245B4A] ${
                                  selectedSubject === category
                                    ? 'border-[#245B4A] bg-[#245B4A] text-white'
                                    : 'border-line bg-white text-textMuted hover:border-[#245B4A] hover:bg-slateBg hover:text-navy'
                                }`}
                              >
                                {category}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-textMuted">
                          No matching suggestions. Your custom topic can still be used.
                        </p>
                      )}
                    </div>

                    <div aria-hidden="true" className="border-t border-line" />
                    <fieldset className="border-0">
                      <legend className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy">
                        <Gauge size={17} className="text-textMuted" aria-hidden="true" />
                        Difficulty
                      </legend>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {LEVELS.map((level) => {
                          const isSelected = difficulty === level;
                          const descriptions: Record<Level, string> = {
                            Beginner: 'Build confidence',
                            Intermediate: 'Test your skills',
                            Advanced: 'Push your limits',
                          };
                          return (
                            <button
                              key={level}
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() => {
                                setDifficulty(level);
                                setAssessment(null);
                                setResult(null);
                                setGenerationError('');
                              }}
                              className={`min-h-[76px] rounded-xl border p-3.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245B4A] ${
                                isSelected
                                  ? 'border-[#245B4A] bg-[#F0F5F1] text-[#245B4A]'
                                  : 'border-line bg-white text-navy hover:border-[#9EAEA4] hover:bg-slateBg'
                              }`}
                            >
                              <span className="block text-sm font-semibold">{level}</span>
                              <span className={`mt-1 block text-xs ${isSelected ? 'text-[#245B4A]' : 'text-textMuted'}`}>
                                {descriptions[level]}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>

                    <div aria-hidden="true" className="border-t border-line" />
                    <fieldset className="border-0">
                      <legend className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy">
                        <Hash size={17} className="text-textMuted" aria-hidden="true" />
                        Number of questions
                      </legend>
                      <div className="grid grid-cols-5 gap-2">
                        {PRESET_COUNTS.map((count) => {
                          const isSelected = !customCountSelected && questionCount === count;
                          return (
                            <button
                              key={count}
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() => {
                                setQuestionCount(count);
                                setDurationMinutes(estimateDurationMinutes(count));
                                setCustomCountSelected(false);
                                setAssessment(null);
                                setResult(null);
                                setGenerationError('');
                              }}
                              className={`min-h-11 rounded-lg border text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245B4A] sm:text-sm ${
                                isSelected
                                  ? 'border-[#245B4A] bg-[#245B4A] text-white'
                                  : 'border-line bg-white text-navy hover:border-[#9EAEA4] hover:bg-slateBg'
                              }`}
                            >
                              {count}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          aria-pressed={customCountSelected}
                          onClick={() => {
                            setCustomCountSelected(true);
                            setAssessment(null);
                            setResult(null);
                            setGenerationError('');
                          }}
                          className={`min-h-11 rounded-lg border text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245B4A] sm:text-sm ${
                            customCountSelected
                              ? 'border-[#245B4A] bg-[#245B4A] text-white'
                              : 'border-line bg-white text-navy hover:border-[#9EAEA4] hover:bg-slateBg'
                          }`}
                        >
                          Custom
                        </button>
                      </div>
                      {customCountSelected && (
                        <div className="mt-4 max-w-xs">
                          <label htmlFor="quiz-question-count" className="mb-1.5 block text-sm font-medium text-navy">
                            Custom question count
                          </label>
                          <input
                            id="quiz-question-count"
                            type="number"
                            min={1}
                            max={MAX_QUESTION_COUNT}
                            value={questionCount}
                            onChange={(event) => {
                              const nextValue = Number(event.target.value) || 1;
                              const nextCount = Math.min(Math.max(nextValue, 1), MAX_QUESTION_COUNT);
                              setQuestionCount(nextCount);
                              setDurationMinutes(estimateDurationMinutes(nextCount));
                              setAssessment(null);
                              setResult(null);
                              setGenerationError('');
                            }}
                            className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-navy outline-none transition-colors focus:border-[#245B4A] focus:ring-2 focus:ring-[#245B4A]/15"
                          />
                          <p className="mt-1.5 text-xs text-textMuted">Enter a number from 1 to {MAX_QUESTION_COUNT}.</p>
                        </div>
                      )}
                    </fieldset>

                    <fieldset className="border-0 border-t border-line pt-6">
                      <legend className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy">
                        <Clock3 size={17} className="text-textMuted" aria-hidden="true" />
                        Quiz time limit
                      </legend>
                      <div className="flex max-w-xs items-center gap-3">
                        <button
                          type="button"
                          aria-label="Decrease quiz time by one minute"
                          disabled={durationMinutes <= 1}
                          onClick={() => setDurationMinutes((minutes) => Math.max(1, minutes - 1))}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-white text-lg font-semibold text-navy transition-colors hover:border-[#9EAEA4] hover:bg-slateBg disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245B4A]"
                        >
                          −
                        </button>
                        <label htmlFor="quiz-duration" className="sr-only">Quiz time limit in minutes</label>
                        <div className="relative min-w-0 flex-1">
                          <input
                            id="quiz-duration"
                            type="number"
                            min={1}
                            max={MAX_QUIZ_DURATION_MINUTES}
                            value={durationMinutes}
                            onChange={(event) => {
                              const nextValue = Number(event.target.value) || 1;
                              setDurationMinutes(
                                Math.min(Math.max(nextValue, 1), MAX_QUIZ_DURATION_MINUTES),
                              );
                              setAssessment(null);
                              setResult(null);
                              setGenerationError('');
                            }}
                            className="w-full rounded-lg border border-line bg-white px-3 py-2.5 pr-16 text-center text-sm font-semibold text-navy outline-none focus:border-[#245B4A] focus:ring-2 focus:ring-[#245B4A]/15"
                          />
                          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-textMuted">
                            minutes
                          </span>
                        </div>
                        <button
                          type="button"
                          aria-label="Increase quiz time by one minute"
                          disabled={durationMinutes >= MAX_QUIZ_DURATION_MINUTES}
                          onClick={() => setDurationMinutes((minutes) => Math.min(
                            MAX_QUIZ_DURATION_MINUTES,
                            minutes + 1,
                          ))}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-white text-lg font-semibold text-navy transition-colors hover:border-[#9EAEA4] hover:bg-slateBg disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245B4A]"
                        >
                          +
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-textMuted">
                        Adjust the default estimate. Choose from 1 to {MAX_QUIZ_DURATION_MINUTES} minutes.
                      </p>
                    </fieldset>

                    {generationError && (
                      <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
                        <ShieldAlert className="mt-0.5 shrink-0 text-red-600" size={19} aria-hidden="true" />
                        <div>
                          <p className="text-sm font-semibold">We couldn’t create your quiz</p>
                          <p className="mt-1 text-sm leading-5">{generationError}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
                      <div className="max-w-sm space-y-1.5">
                        <p className="text-sm leading-5 text-textMuted">
                          Preview your questions before starting. Explanations are included in your answer review.
                        </p>
                        <p className="text-xs leading-5 text-textMuted">
                          Note: Due to current API limitations, we can generate up to 10 questions at a time.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="accent"
                        isLoading={generating}
                        aria-busy={generating}
                        onClick={() => void handleGenerateAssessment()}
                        className="min-h-12 w-full shrink-0 gap-2 rounded-xl px-6 sm:w-auto"
                      >
                        {generating ? 'Building your quiz…' : 'Generate quiz'}
                        {!generating && <ArrowRight size={17} aria-hidden="true" />}
                      </Button>
                    </div>
                  </div>
                </div>

                <aside
                  aria-label="Quiz summary"
                  className="h-fit rounded-2xl border border-line bg-white p-5 sm:p-6 lg:sticky lg:top-6"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-navy">Quiz summary</p>
                    <span className="rounded-full bg-slateBg px-2.5 py-1 text-xs font-medium text-textMuted">
                      Practice
                    </span>
                  </div>
                  <h2 className="mt-5 break-words text-xl font-bold leading-snug text-navy">
                    {selectedSubject.trim() || 'Choose a topic'}
                  </h2>
                  <p className="mt-1 text-sm text-textMuted">Personalized assessment</p>

                  <dl className="mt-6 divide-y divide-line border-y border-line">
                    <div className="flex items-center justify-between gap-4 py-4">
                      <dt className="flex items-center gap-2 text-sm text-textMuted">
                        <Gauge size={16} aria-hidden="true" />
                        Difficulty
                      </dt>
                      <dd className="text-sm font-semibold text-navy">{difficulty}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-4">
                      <dt className="flex items-center gap-2 text-sm text-textMuted">
                        <Hash size={16} aria-hidden="true" />
                        Questions
                      </dt>
                      <dd className="text-sm font-semibold text-navy">{questionCount}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-4">
                      <dt className="flex items-center gap-2 text-sm text-textMuted">
                        <Clock3 size={16} aria-hidden="true" />
                        Time limit
                      </dt>
                      <dd className="text-sm font-semibold text-navy">{durationMinutes} min</dd>
                    </div>
                  </dl>

                  <div className="mt-5 rounded-xl bg-slateBg p-4">
                    <p className="text-sm font-medium text-navy">Ready when you are</p>
                    <p className="mt-1.5 text-sm leading-5 text-textMuted">
                      You’ll need 70% to pass. Review explanations after you submit.
                    </p>
                  </div>
                </aside>
              </div>
            </section>
          )}

        </div>

        {viewState === 'idle' && user && token && (
          <div className="mt-6">
            <PracticeHistory token={token} userId={user.id} />
          </div>
        )}

      </div>
      <SettingsDialog isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};