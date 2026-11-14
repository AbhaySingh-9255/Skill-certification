import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Circle,
  Clock3,
  Flag,
  ListChecks,
  LogOut,
  RotateCcw,
  Send,
} from 'lucide-react';
import { Timer } from './Timer';
import { Button } from '../Button';

interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface Question {
  id: string;
  prompt: string;
  explanation: string;
  options: QuestionOption[];
  points: number;
}

interface ViolationLog {
  timestamp: number;
  type: 'TAB_SWITCH' | 'BLUR' | 'FULLSCREEN_EXIT';
  detail: string;
}

interface QuizEngineProps {
  title: string;
  durationMinutes: number;
  questions: Question[];
  onComplete: (
    score: number,
    passed: boolean,
    violations: ViolationLog[],
    answers: Record<string, string>,
  ) => void;
  onLeave: () => void;
  fullscreenWarning: string;
  onFullscreenError: (message: string) => void;
}

type DialogState = 'submit' | 'leave' | null;

export const QuizEngine: React.FC<QuizEngineProps> = ({
  title,
  durationMinutes,
  questions,
  onComplete,
  onLeave,
  fullscreenWarning,
  onFullscreenError,
}) => {
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});
  const [violations, setViolations] = useState<ViolationLog[]>([]);
  const [showWarning, setShowWarning] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasSubmittedRef = useRef(false);
  const hasEnteredFullscreenRef = useRef(false);
  const answersRef = useRef(answers);
  const violationsRef = useRef(violations);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    violationsRef.current = violations;
  }, [violations]);

  const totalQuestions = questions.length;
  const currentQuestion = questions[currentQIndex];
  const selectedOptionId = currentQuestion ? answers[currentQuestion.id] : undefined;
  const answeredCount = Object.keys(answers).length;
  const markedCount = Object.values(markedForReview).filter(Boolean).length;

  const finish = useCallback(
    (score: number, passed: boolean, allViolations: ViolationLog[]) => {
      if (hasSubmittedRef.current) return;
      hasSubmittedRef.current = true;
      setIsSubmitting(true);
      onComplete(score, passed, allViolations, answersRef.current);
    },
    [onComplete],
  );

  const registerViolation = useCallback(
    (type: ViolationLog['type'], detail: string) => {
      if (hasSubmittedRef.current) return;
      setViolations((previous) => {
        const next = [...previous, { timestamp: Date.now(), type, detail }];
        violationsRef.current = next;
        if (next.length >= 3) {
          window.setTimeout(() => finish(0, false, next), 0);
        }
        return next;
      });
      setShowWarning(true);
    },
    [finish],
  );

  useEffect(() => {
    hasEnteredFullscreenRef.current = Boolean(document.fullscreenElement);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        registerViolation('TAB_SWITCH', 'User switched tabs or minimized the window.');
      }
    };

    const handleBlur = () => {
      registerViolation('BLUR', 'User left the application window.');
    };

    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        hasEnteredFullscreenRef.current = true;
      } else if (hasEnteredFullscreenRef.current && !hasSubmittedRef.current) {
        registerViolation('FULLSCREEN_EXIT', 'User exited fullscreen during the quiz.');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [registerViolation]);

  useEffect(() => {
    const preventDefault = (event: Event) => event.preventDefault();
    document.addEventListener('contextmenu', preventDefault);
    document.addEventListener('copy', preventDefault);
    document.addEventListener('cut', preventDefault);

    return () => {
      document.removeEventListener('contextmenu', preventDefault);
      document.removeEventListener('copy', preventDefault);
      document.removeEventListener('cut', preventDefault);
    };
  }, []);

  const handleSelectAnswer = (optionId: string) => {
    if (!currentQuestion || hasSubmittedRef.current) return;
    const nextAnswers = { ...answersRef.current, [currentQuestion.id]: optionId };
    answersRef.current = nextAnswers;
    setAnswers(nextAnswers);
  };

  const submitAnswers = useCallback(() => {
    if (hasSubmittedRef.current) return;
    if (!questions.length) {
      finish(0, false, violationsRef.current);
      return;
    }

    let earnedPoints = 0;
    let totalPoints = 0;

    questions.forEach((question) => {
      totalPoints += question.points;
      const selectedId = answersRef.current[question.id];
      const correctOption = question.options.find((option) => option.isCorrect);

      if (selectedId && correctOption && selectedId === correctOption.id) {
        earnedPoints += question.points;
      }
    });

    const percentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
    finish(Math.round(percentage), percentage >= 70, violationsRef.current);
  }, [finish, questions]);

  const handleTimeUp = useCallback(() => {
    submitAnswers();
  }, [submitAnswers]);

  const handleNext = () => {
    if (currentQIndex < totalQuestions - 1) {
      setCurrentQIndex((previous) => previous + 1);
    } else {
      setDialog('submit');
    }
  };

  const handleClearResponse = () => {
    if (!currentQuestion || !answersRef.current[currentQuestion.id]) return;
    const nextAnswers = { ...answersRef.current };
    delete nextAnswers[currentQuestion.id];
    answersRef.current = nextAnswers;
    setAnswers(nextAnswers);
  };

  const handleToggleReview = () => {
    if (!currentQuestion) return;
    setMarkedForReview((previous) => ({
      ...previous,
      [currentQuestion.id]: !previous[currentQuestion.id],
    }));
  };

  const handleResume = () => {
    setShowWarning(false);
    if (hasEnteredFullscreenRef.current && !document.fullscreenElement && document.fullscreenEnabled) {
      try {
        void document.documentElement.requestFullscreen().catch(() => {
          onFullscreenError('Fullscreen could not be restored. Press the fullscreen control or restart the quiz.');
        });
      } catch {
        onFullscreenError('Fullscreen could not be restored. Press the fullscreen control or restart the quiz.');
      }
    }
  };

  const handleConfirmLeave = () => {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    onLeave();
  };

  if (!currentQuestion) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slateBg p-6">
        <section role="alert" className="w-full max-w-lg rounded-2xl border border-line bg-white p-8 text-center">
          <AlertTriangle className="mx-auto mb-4 text-amber-700" size={32} aria-hidden="true" />
          <h1 className="text-xl font-semibold text-navy">This quiz is unavailable</h1>
          <p className="mt-2 text-sm text-textMuted">
            No questions were provided. Return to your dashboard and try again.
          </p>
          <Button className="mt-6" onClick={onLeave}>Return to dashboard</Button>
        </section>
      </main>
    );
  }

  const completionPercent = Math.round((answeredCount / totalQuestions) * 100);
  const markedForReviewCurrent = Boolean(markedForReview[currentQuestion.id]);

  return (
    <main className="min-h-screen bg-slateBg px-4 py-5 text-navy sm:px-6 sm:py-8 lg:px-8">
      {dialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#202B28]/55 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSubmitting) setDialog(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${dialog}-dialog-title`}
            className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl sm:p-8"
          >
            {dialog === 'submit' ? (
              <>
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#EAF1EC] text-[#245B4A]">
                  <Send size={20} aria-hidden="true" />
                </span>
                <h2 id="submit-dialog-title" className="mt-5 text-xl font-bold text-navy">
                  Submit your assessment?
                </h2>
                <p className="mt-2 text-sm leading-6 text-textMuted">
                  You’ve answered {answeredCount} of {totalQuestions} questions.
                  {totalQuestions - answeredCount > 0
                    ? ` ${totalQuestions - answeredCount} unanswered question${totalQuestions - answeredCount === 1 ? '' : 's'} will be submitted blank.`
                    : ' Your responses are ready to submit.'}
                </p>
                {markedCount > 0 && (
                  <p className="mt-2 text-sm text-[#245B4A]">
                    {markedCount} question{markedCount === 1 ? '' : 's'} still marked for review.
                  </p>
                )}
                <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={isSubmitting}
                    onClick={() => setDialog(null)}
                  >
                    Review answers
                  </Button>
                  <Button
                    type="button"
                    disabled={isSubmitting}
                    isLoading={isSubmitting}
                    onClick={submitAnswers}
                    className="gap-2"
                  >
                    {isSubmitting ? 'Submitting…' : 'Submit assessment'}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F8EFE8] text-[#8A4B23]">
                  <LogOut size={20} aria-hidden="true" />
                </span>
                <h2 id="leave-dialog-title" className="mt-5 text-xl font-bold text-navy">
                  Leave this assessment?
                </h2>
                <p className="mt-2 text-sm leading-6 text-textMuted">
                  Your answers and progress will be discarded. You can start a new practice quiz from the dashboard.
                </p>
                <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Button variant="secondary" onClick={() => setDialog(null)}>
                    Keep taking quiz
                  </Button>
                  <Button variant="secondary" onClick={handleConfirmLeave} className="border-[#A94835] text-[#8C3428] hover:bg-[#FBF0EE]">
                    Leave quiz
                  </Button>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#202B28]/55 p-4">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="focus-warning-title"
            className="w-full max-w-md rounded-2xl border border-[#D8DED8] bg-white p-7 text-center"
          >
            <AlertTriangle className="mx-auto mb-4 text-amber-700" size={36} aria-hidden="true" />
            <h2 id="focus-warning-title" className="text-xl font-bold text-navy">Focus change detected</h2>
            <p className="mt-2 text-sm leading-6 text-textMuted">
              Leaving the quiz window is recorded as a focus warning. Your answers remain on this page.
            </p>
            <Button className="mt-6" onClick={handleResume}>Resume assessment</Button>
          </section>
        </div>
      )}

      <div className="mx-auto max-w-7xl">
        <header className="mb-5 rounded-2xl border border-line bg-white px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-textMuted">Assessment in progress</p>
              <h1 className="mt-1 truncate text-lg font-bold text-navy sm:text-xl">{title}</h1>
              <p className="mt-1 text-sm text-textMuted">
                Question {currentQIndex + 1} of {totalQuestions}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <div className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-slateBg px-3">
                <Clock3 size={17} className="text-textMuted" aria-hidden="true" />
                <Timer durationSeconds={durationMinutes * 60} onTimeUp={handleTimeUp} />
              </div>
              <div
                role="status"
                aria-live="polite"
                className="hidden rounded-xl border border-line px-3 py-2 text-xs text-textMuted md:block"
              >
                Progress held in this session · not synced
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDialog('leave')}
                className="min-h-11 gap-2 rounded-xl"
                aria-label="Leave assessment"
              >
                <LogOut size={16} aria-hidden="true" />
                <span className="hidden sm:inline">Leave</span>
              </Button>
            </div>
          </div>
          <div
            role="status"
            className="mt-3 border-t border-line pt-3 text-xs text-textMuted md:hidden"
          >
            Progress is in this session only · not auto-saved
          </div>
          {fullscreenWarning && (
            <p role="status" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {fullscreenWarning}
            </p>
          )}
        </header>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section aria-label={`Question ${currentQIndex + 1}`} className="min-w-0">
            <div className="mb-4 rounded-2xl border border-line bg-white px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-medium text-navy">Assessment progress</span>
                <span className="text-textMuted">{answeredCount} of {totalQuestions} answered</span>
              </div>
              <div
                className="mt-3 h-2 overflow-hidden rounded-full bg-[#E9ECE8]"
                role="progressbar"
                aria-label="Questions answered"
                aria-valuemin={0}
                aria-valuemax={totalQuestions}
                aria-valuenow={answeredCount}
              >
                <div
                  className="h-full rounded-full bg-[#245B4A] transition-[width] duration-300 ease-out"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
            </div>

            <article className="rounded-2xl border border-line bg-white p-5 sm:p-8 lg:p-10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-slateBg px-3 py-1.5 text-xs font-semibold text-textMuted">
                  <ListChecks size={15} aria-hidden="true" />
                  Question {currentQIndex + 1}
                  <span aria-hidden="true">/</span>
                  {totalQuestions}
                </span>
                <span className="text-sm text-textMuted">{currentQuestion.points} point{currentQuestion.points === 1 ? '' : 's'}</span>
              </div>

              <h2 className="mt-6 text-xl font-semibold leading-8 text-navy sm:mt-8 sm:text-2xl sm:leading-9">
                {currentQuestion.prompt}
              </h2>
              <p id="answer-instructions" className="mt-2 text-sm text-textMuted">
                Select one answer.
              </p>

              <fieldset className="mt-6 space-y-3 sm:mt-8">
                <legend className="sr-only">Answer choices</legend>
                {currentQuestion.options.map((option, index) => {
                  const isSelected = selectedOptionId === option.id;
                  return (
                    <label key={option.id} className="block cursor-pointer">
                      <input
                        type="radio"
                        name={`question-${currentQuestion.id}`}
                        value={option.id}
                        checked={isSelected}
                        onChange={() => handleSelectAnswer(option.id)}
                        aria-describedby="answer-instructions"
                        className="peer sr-only"
                      />
                      <span
                        className={`flex min-h-[60px] items-center gap-4 rounded-xl border px-4 py-3.5 transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#245B4A] sm:px-5 ${
                          isSelected
                            ? 'border-[#245B4A] bg-[#F0F5F1]'
                            : 'border-line bg-white hover:border-[#9EAEA4] hover:bg-slateBg'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            isSelected ? 'border-[#245B4A] bg-[#245B4A] text-white' : 'border-[#9AA69D] bg-white'
                          }`}
                        >
                          {isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
                        </span>
                        <span className={`min-w-0 flex-1 text-sm leading-6 sm:text-base ${isSelected ? 'font-medium text-navy' : 'text-navy'}`}>
                          {option.text}
                        </span>
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${
                          isSelected ? 'bg-[#245B4A] text-white' : 'bg-slateBg text-textMuted'
                        }`}>
                          {String.fromCharCode(65 + index)}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>

              <div className="mt-7 flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                  <button
                    type="button"
                    onClick={handleToggleReview}
                    aria-pressed={markedForReviewCurrent}
                    className={`inline-flex items-center gap-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245B4A] ${
                      markedForReviewCurrent ? 'text-[#245B4A]' : 'text-textMuted hover:text-navy'
                    }`}
                  >
                    <Flag size={16} aria-hidden="true" />
                    {markedForReviewCurrent ? 'Marked for review' : 'Mark for review'}
                  </button>
                  {selectedOptionId && (
                    <button
                      type="button"
                      onClick={handleClearResponse}
                      className="inline-flex items-center gap-2 text-sm font-medium text-textMuted transition-colors hover:text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245B4A]"
                    >
                      <RotateCcw size={15} aria-hidden="true" />
                      Clear response
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={currentQIndex === 0 || isSubmitting}
                    onClick={() => setCurrentQIndex((previous) => Math.max(0, previous - 1))}
                    className="min-h-11 gap-2 rounded-xl"
                  >
                    <ArrowLeft size={16} aria-hidden="true" />
                    Previous
                  </Button>
                  <Button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleNext}
                    className="min-h-11 gap-2 rounded-xl"
                  >
                    {currentQIndex === totalQuestions - 1 ? 'Review & submit' : 'Next'}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </article>
          </section>

          <aside className="h-fit rounded-2xl border border-line bg-white p-5 sm:p-6 lg:sticky lg:top-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-navy">Question navigator</h2>
                <p className="mt-1 text-sm text-textMuted">Select a question to jump to it.</p>
              </div>
              <span className="rounded-full bg-slateBg px-2.5 py-1 text-xs font-semibold text-textMuted">
                {currentQIndex + 1}/{totalQuestions}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-5">
              {questions.map((question, index) => {
                const isAnswered = Boolean(answers[question.id]);
                const isMarked = Boolean(markedForReview[question.id]);
                const isCurrent = currentQIndex === index;
                let stateClass = 'border-line bg-white text-navy hover:border-[#9AA69D]';
                if (isAnswered) stateClass = 'border-[#245B4A] bg-[#245B4A] text-white hover:bg-[#194638]';
                if (isMarked && !isAnswered) stateClass = 'border-[#9A642B] bg-[#FBF4E9] text-[#754915] hover:bg-[#F6EBD8]';
                if (isCurrent) stateClass = `${stateClass} ring-2 ring-[#245B4A] ring-offset-2`;
                return (
                  <button
                    key={question.id}
                    type="button"
                    onClick={() => setCurrentQIndex(index)}
                    aria-current={isCurrent ? 'step' : undefined}
                    aria-label={`Question ${index + 1}, ${isAnswered ? 'answered' : 'unanswered'}${isMarked ? ', marked for review' : ''}${isCurrent ? ', current question' : ''}`}
                    className={`relative flex h-10 w-full items-center justify-center rounded-lg border text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245B4A] ${stateClass}`}
                  >
                    {index + 1}
                    {isMarked && (
                      <span aria-hidden="true" className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#9A642B]" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 space-y-2 border-t border-line pt-4 text-xs text-textMuted">
              <p className="flex items-center gap-2">
                <Check size={14} className="text-[#245B4A]" aria-hidden="true" />
                Answered
              </p>
              <p className="flex items-center gap-2">
                <Circle size={14} aria-hidden="true" />
                Unanswered
              </p>
              <p className="flex items-center gap-2">
                <Flag size={14} className="text-[#9A642B]" aria-hidden="true" />
                Marked for review
              </p>
            </div>

            <div className="mt-5 rounded-xl bg-slateBg p-4">
              <p className="text-sm font-semibold text-navy">{answeredCount} of {totalQuestions} answered</p>
              {markedCount > 0 && (
                <p className="mt-1 text-sm text-[#754915]">{markedCount} marked for review</p>
              )}
              <Button
                type="button"
                onClick={() => setDialog('submit')}
                disabled={isSubmitting}
                className="mt-4 min-h-11 w-full gap-2 rounded-xl"
              >
                <Send size={16} aria-hidden="true" />
                Submit assessment
              </Button>
            </div>
          </aside>
        </div>

        <p className="mt-5 text-center text-xs leading-5 text-textMuted">
          Progress is held in this browser session and is not synced or auto-saved.
          {violations.length > 0 && ` ${violations.length} focus warning${violations.length === 1 ? '' : 's'} recorded.`}
        </p>
      </div>
    </main>
  );
};
