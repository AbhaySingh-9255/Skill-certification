import React, { useState, useEffect } from 'react';

interface TimerProps {
  durationSeconds: number;
  onTimeUp: () => void;
}

export const Timer: React.FC<TimerProps> = ({ durationSeconds, onTimeUp }) => {
  const [timeLeft, setTimeLeft] = useState(durationSeconds);

  useEffect(() => {
    if (timeLeft <= 0) {
      onTimeUp();
      return;
    }

    const timerId = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timerId);
  }, [timeLeft, onTimeUp]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div
      role="timer"
      aria-label={`Time remaining: ${minutes} minutes ${seconds} seconds`}
      aria-live="off"
      className={`font-mono text-lg font-bold ${timeLeft < 60 ? 'text-red-700' : 'text-navy'}`}
    >
      {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
    </div>
  );
};