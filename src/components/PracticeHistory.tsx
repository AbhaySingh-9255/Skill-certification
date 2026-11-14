import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Award, BookOpenCheck, CheckCircle2, Clock3, History, XCircle } from 'lucide-react';
import {
  fetchAssessmentHistory,
  loadPracticeHistory,
  type AssessmentHistoryEntry,
  type PracticeHistoryEntry,
} from '../services/historyService';

type HistoryItem = {
  id: string;
  title: string;
  category: string;
  score: number | null;
  passed: boolean | null;
  completedAt: number;
  timeTakenSeconds?: number;
  source: 'Practice quiz' | 'Assessment';
};

type OutcomeSlice = {
  label: string;
  count: number;
  color: string;
};

const pieSlicePath = (startAngle: number, endAngle: number) => {
  const radius = 50;
  const center = 60;
  const toPoint = (angle: number) => {
    const radians = (angle * Math.PI) / 180;
    return {
      x: center + radius * Math.cos(radians),
      y: center + radius * Math.sin(radians),
    };
  };
  const start = toPoint(startAngle);
  const end = toPoint(endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${center} ${center} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
};

const formatDate = (timestamp: number) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(timestamp));

const timestampFromAssessment = (timestamp: number | null) => {
  if (timestamp === null) return 0;
  return timestamp < 100_000_000_000 ? timestamp * 1000 : timestamp;
};

export const PracticeHistory = ({
  token,
  userId,
}: {
  token: string;
  userId: string;
}) => {
  const [practiceHistory, setPracticeHistory] = useState<PracticeHistoryEntry[]>([]);
  const [assessmentHistory, setAssessmentHistory] = useState<AssessmentHistoryEntry[]>([]);
  const [assessmentTotal, setAssessmentTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [practiceError, setPracticeError] = useState('');
  const [assessmentError, setAssessmentError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => loadPracticeHistory(userId))
      .then((entries) => {
        if (active) setPracticeHistory(entries);
      })
      .catch((error: unknown) => {
        if (active) {
          setPracticeError(error instanceof Error ? error.message : 'Could not load local practice history.');
        }
      });

    fetchAssessmentHistory(token)
      .then((response) => {
        if (!active) return;
        setAssessmentHistory(response.items);
        setAssessmentTotal(response.total);
      })
      .catch((error: unknown) => {
        if (active) {
          setAssessmentError(error instanceof Error ? error.message : 'Could not load assessment history.');
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token, userId]);

  const historyItems = useMemo<HistoryItem[]>(() => {
    const practiceItems: HistoryItem[] = practiceHistory.map((entry) => ({
      id: `practice-${entry.id}`,
      title: entry.title,
      category: `${entry.category} · ${entry.difficulty} · ${entry.question_count} questions`,
      score: entry.score_percent,
      passed: entry.passed,
      completedAt: Date.parse(entry.submitted_at),
      source: 'Practice quiz',
    }));
    const assessmentItems: HistoryItem[] = assessmentHistory.map((entry) => ({
      id: `assessment-${entry.id}`,
      title: entry.title || 'Assessment',
      category: entry.category || 'Course assessment',
      score: entry.score_percent,
      passed: entry.passed,
      completedAt: timestampFromAssessment(entry.submitted_at),
      timeTakenSeconds: entry.time_taken_seconds,
      source: 'Assessment',
    }));
    return [...practiceItems, ...assessmentItems]
      .sort((left, right) => right.completedAt - left.completedAt)
      .slice(0, 8);
  }, [assessmentHistory, practiceHistory]);

  const totalTests = assessmentTotal + practiceHistory.length;
  const outcomeSlices: OutcomeSlice[] = [
    {
      label: 'Passed',
      count: practiceHistory.filter((entry) => entry.passed).length
        + assessmentHistory.filter((entry) => entry.passed === true).length,
      color: '#245B4A',
    },
    {
      label: 'Not passed',
      count: practiceHistory.filter((entry) => !entry.passed).length
        + assessmentHistory.filter((entry) => entry.passed === false).length,
      color: '#A65E31',
    },
    {
      label: 'Not graded',
      count: assessmentHistory.filter((entry) => entry.passed === null).length,
      color: '#89958D',
    },
  ].filter((slice) => slice.count > 0);
  const chartTotal = outcomeSlices.reduce((sum, slice) => sum + slice.count, 0);
  let chartAngle = -90;
  const chartPaths = outcomeSlices.map((slice) => {
    const endAngle = chartAngle + (slice.count / chartTotal) * 360;
    const path = {
      ...slice,
      path: endAngle - chartAngle >= 359.999
        ? null
        : pieSlicePath(chartAngle, endAngle),
    };
    chartAngle = endAngle;
    return path;
  });

  return (
    <section aria-labelledby="test-history-title" className="rounded-2xl border border-line bg-white p-5 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#245B4A]">
            <History size={19} aria-hidden="true" />
            <p className="text-xs font-semibold uppercase tracking-[0.14em]">Your progress</p>
          </div>
          <h2 id="test-history-title" className="mt-2 text-xl font-bold text-navy sm:text-2xl">
            Test history
          </h2>
          <p className="mt-1 text-sm text-textMuted">See the quizzes and assessments you’ve completed.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:min-w-[280px]">
          <div className="rounded-xl border border-line bg-slateBg px-4 py-3">
            <p className="text-2xl font-bold text-navy" aria-live="polite">
              {isLoading || assessmentError || practiceError ? '—' : totalTests}
            </p>
            <p className="mt-0.5 text-xs text-textMuted">Tests completed</p>
          </div>
          <div className="rounded-xl border border-line bg-slateBg px-4 py-3">
            <p className="text-2xl font-bold text-navy">
              {isLoading || practiceError ? '—' : practiceHistory.length}
            </p>
            <p className="mt-0.5 text-xs text-textMuted">Practice quizzes</p>
          </div>
        </div>
      </div>

      {practiceError && (
        <p role="alert" className="mt-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
          <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
          {practiceError}
        </p>
      )}
      {assessmentError && (
        <p role="alert" className="mt-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
          <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
          {assessmentError}
        </p>
      )}

      {!isLoading && chartTotal > 0 && (
        <figure className="mt-6 rounded-xl border border-line bg-slateBg/60 p-4 sm:p-5">
          <figcaption className="text-sm font-semibold text-navy">Test outcomes</figcaption>
          <p className="mt-1 text-xs text-textMuted">
            {assessmentError || practiceError
              ? 'Partial breakdown: some history could not be loaded.'
              : assessmentTotal > assessmentHistory.length
              ? `Based on saved practice quizzes and the ${assessmentHistory.length} most recent assessments.`
              : 'Breakdown of your recorded practice quizzes and assessments.'}
          </p>
          <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:justify-center sm:gap-10">
            <svg
              viewBox="0 0 120 120"
              className="h-36 w-36 shrink-0"
              role="img"
              aria-label={`Pie chart: ${outcomeSlices.map((slice) => `${slice.count} ${slice.label.toLowerCase()}`).join(', ')}`}
            >
              {chartTotal === 1 ? (
                <circle cx="60" cy="60" r="50" fill={chartPaths[0].color} />
              ) : (
                chartPaths.map((slice) => slice.path && (
                  <path key={slice.label} d={slice.path} fill={slice.color} />
                ))
              )}
            </svg>
            <ul className="grid w-full max-w-xs gap-3 sm:w-auto">
              {outcomeSlices.map((slice) => (
                <li key={slice.label} className="flex items-center justify-between gap-8 text-sm">
                  <span className="flex items-center gap-2 text-textMuted">
                    <span
                      aria-hidden="true"
                      className="h-3 w-3 rounded-sm"
                      style={{ backgroundColor: slice.color }}
                    />
                    {slice.label}
                  </span>
                  <span className="font-semibold text-navy">
                    {slice.count} <span className="font-normal text-textMuted">
                      ({Math.round((slice.count / chartTotal) * 100)}%)
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </figure>
      )}

      <div className="mt-6 border-t border-line">
        {isLoading ? (
          <p role="status" className="py-6 text-sm text-textMuted">Loading your test history…</p>
        ) : historyItems.length === 0 && (assessmentError || practiceError) ? (
          <p role="status" className="py-6 text-sm text-textMuted">
            History is temporarily unavailable. Try refreshing the page.
          </p>
        ) : historyItems.length === 0 ? (
          <div className="py-8 text-center">
            <BookOpenCheck className="mx-auto text-textMuted" size={26} aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-navy">No completed tests yet</p>
            <p className="mt-1 text-sm text-textMuted">Your completed quizzes and assessments will appear here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {historyItems.map((item) => (
              <li key={item.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    item.passed === true
                      ? 'bg-[#EAF1EC] text-[#245B4A]'
                      : item.passed === false
                        ? 'bg-[#F8EFE8] text-[#8A4B23]'
                        : 'bg-slateBg text-textMuted'
                  }`}>
                    {item.passed === true
                      ? <CheckCircle2 size={18} aria-hidden="true" />
                      : item.passed === false
                        ? <XCircle size={18} aria-hidden="true" />
                        : <Award size={18} aria-hidden="true" />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-navy">{item.title}</p>
                    <p className="mt-1 text-xs text-textMuted">{item.category}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-textMuted">
                      <Clock3 size={13} aria-hidden="true" />
                      {item.completedAt ? formatDate(item.completedAt) : 'Completion date unavailable'}
                      {item.timeTakenSeconds !== undefined && ` · ${Math.floor(item.timeTakenSeconds / 60)} min`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-12 sm:shrink-0 sm:pl-0">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    item.source === 'Practice quiz'
                      ? 'bg-slateBg text-textMuted'
                      : 'bg-[#F0F5F1] text-[#245B4A]'
                  }`}>
                    {item.source}
                  </span>
                  <span className="min-w-12 text-right text-sm font-bold text-navy">
                    {item.score === null ? '—' : `${Math.round(item.score)}%`}
                  </span>
                  {item.passed !== null && (
                    <span className={`text-xs font-medium ${item.passed ? 'text-[#245B4A]' : 'text-[#8A4B23]'}`}>
                      {item.passed ? 'Passed' : 'Not passed'}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-3 text-xs leading-5 text-textMuted">
        Practice quiz history is saved in this browser for this account. Assessment history is loaded from your account.
      </p>
    </section>
  );
};
