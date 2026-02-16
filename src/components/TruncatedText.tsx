import { cn } from '@/lib/utils';

interface TruncatedTextProps {
  text: string;
  maxLength?: number;
  mono?: boolean;
  className?: string;
  prefix?: string;
}

export function TruncatedText({ text, maxLength = 12, mono, className, prefix }: TruncatedTextProps) {
  if (!text) return null;
  const needsTruncation = text.length > maxLength;
  const display = needsTruncation ? text.slice(0, maxLength) + '...' : text;

  return (
    <span
      className={cn(mono && 'font-mono', className)}
      title={needsTruncation ? text : undefined}
    >
      {prefix}{display}
    </span>
  );
}
