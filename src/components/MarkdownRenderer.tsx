'use client';

import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface Props {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: Props) {
  return (
    <div className={cn('prose-surfer', className)}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
