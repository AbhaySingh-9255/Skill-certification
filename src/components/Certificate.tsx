import React from 'react';
import jsPDF from 'jspdf';
import { Button } from './Button';
import { Download, CheckCircle } from 'lucide-react';

interface CertificateProps {
  userName: string;
  courseTitle: string;
  score: number;
  passed: boolean;
  questionCount: number;
}

export const Certificate: React.FC<CertificateProps> = ({
  userName,
  courseTitle,
  score,
  passed,
  questionCount,
}) => {
  const handleDownload = () => {
    if (!passed) return;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, 297, 210, 'F');
    doc.setDrawColor(20, 184, 166);
    doc.setLineWidth(2);
    doc.rect(10, 10, 277, 190);
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.3);
    doc.rect(15, 15, 267, 180);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(13, 148, 136);
    doc.text('SKILLCERT PRO · PRACTICE MILESTONE', 148, 36, { align: 'center' });

    doc.setFontSize(28);
    doc.setTextColor(15, 23, 42);
    doc.text('CERTIFICATE OF COMPLETION', 148, 54, { align: 'center' });

    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('This certificate recognizes that', 148, 72, { align: 'center' });

    doc.setFontSize(34);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(13, 148, 136);
    doc.text(doc.splitTextToSize(userName, 240), 148, 93, { align: 'center' });

    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text('for passing the practice quiz', 148, 112, { align: 'center' });

    doc.setFontSize(19);
    doc.setFont('helvetica', 'bold');
    doc.text(doc.splitTextToSize(courseTitle, 240), 148, 128, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.text(`Score: ${score}%     Questions: ${questionCount}     Completed: ${dateStr}`, 148, 150, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Practice completion only · Not an accredited or independently verified qualification', 148, 177, { align: 'center' });

    const safeName = [...userName.trim()]
      .map((character) => {
        const code = character.charCodeAt(0);
        return /[<>:"/\\|?*]/.test(character) || code <= 0x1f || code === 0x7f ? '_' : character;
      })
      .join('')
      .replace(/\s+/g, '_');
    doc.save(`${safeName || 'Learner'}_Practice_Certificate.pdf`);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
      <CheckCircle className="mx-auto mb-3 h-12 w-12 text-green-500" aria-hidden="true" />
      <h2 className="text-xl font-bold text-navy">Practice quiz passed!</h2>
      <p className="mt-2 text-sm text-textMuted">
        Download your completion certificate for {courseTitle} ({score}%).
      </p>
      <p className="mt-2 text-xs text-gray-500">
        This records a practice milestone; it is not an accredited or independently verified certification.
      </p>
      <Button
        variant="accent"
        onClick={handleDownload}
        disabled={!passed}
        className="mt-5 flex w-full items-center justify-center gap-2"
      >
        <Download size={18} /> Download Practice Certificate
      </Button>
    </div>
  );
};