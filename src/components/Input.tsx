// src/components/Input.tsx
import React from 'react';
import { cn } from '../lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input: React.FC<InputProps> = ({ label, className, ...props }) => {
  return (
    <div className="space-y-1">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <input
        className={cn(
          "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-teal",
          className
        )}
        {...props}
      />
    </div>
  );
};