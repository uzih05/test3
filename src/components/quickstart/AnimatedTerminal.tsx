'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView } from 'framer-motion';

interface TerminalLine {
  type: 'cmd' | 'output' | 'success' | 'comment';
  text: string;
  delay?: number;
}

interface AnimatedTerminalProps {
  lines: TerminalLine[];
  title?: string;
}

export default function AnimatedTerminal({ lines, title = 'Terminal' }: AnimatedTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { once: true, margin: '-40px' });
  const [visibleLines, setVisibleLines] = useState<{ text: string; type: string; done: boolean }[]>([]);
  const [cursorLine, setCursorLine] = useState(0);
  const [cursorChar, setCursorChar] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!inView || started) return;
    setStarted(true);
  }, [inView, started]);

  useEffect(() => {
    if (!started) return;

    if (cursorLine >= lines.length) return;

    const line = lines[cursorLine];
    const isCmd = line.type === 'cmd';
    const startDelay = line.delay ?? (isCmd ? 400 : 80);

    if (cursorChar === 0) {
      // Initialize line
      const timer = setTimeout(() => {
        setVisibleLines((prev) => [
          ...prev,
          { text: '', type: line.type, done: false },
        ]);
        setCursorChar(1);
      }, startDelay);
      return () => clearTimeout(timer);
    }

    const displayText = isCmd ? `$ ${line.text}` : line.text;

    if (cursorChar <= displayText.length) {
      // Type character by character for commands, instant for output
      const charDelay = isCmd ? 30 + Math.random() * 25 : 0;

      if (!isCmd) {
        // Output lines appear instantly
        setVisibleLines((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { text: displayText, type: line.type, done: true };
          return updated;
        });
        setCursorChar(displayText.length + 1);
        return;
      }

      const timer = setTimeout(() => {
        setVisibleLines((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            text: displayText.slice(0, cursorChar),
            type: line.type,
            done: false,
          };
          return updated;
        });
        setCursorChar((c) => c + 1);
      }, charDelay);
      return () => clearTimeout(timer);
    }

    // Line done, move to next
    setVisibleLines((prev) => {
      const updated = [...prev];
      updated[updated.length - 1] = { ...updated[updated.length - 1], done: true };
      return updated;
    });
    setCursorLine((l) => l + 1);
    setCursorChar(0);
  }, [started, cursorLine, cursorChar, lines]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      const el = containerRef.current.querySelector('[data-terminal-body]');
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [visibleLines]);

  const isTyping = cursorLine < lines.length;
  const currentLineIdx = visibleLines.length - 1;

  return (
    <div ref={containerRef} className="rounded-[14px] overflow-hidden border border-border-default">
      {/* Title bar */}
      <div className="bg-bg-elevated px-4 py-2.5 flex items-center gap-2 border-b border-border-default">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-status-error/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-status-warning/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-accent-primary/60" />
        </div>
        <span className="text-[10px] text-text-muted font-mono ml-2">{title}</span>
      </div>

      {/* Terminal body */}
      <div
        data-terminal-body
        className="bg-[#0d0d0d] px-4 py-3 font-mono text-xs leading-relaxed max-h-[280px] overflow-y-auto"
      >
        {visibleLines.map((vl, i) => (
          <div key={i} className="min-h-[1.4em]">
            <span
              className={
                vl.type === 'cmd'
                  ? 'text-accent-primary'
                  : vl.type === 'success'
                    ? 'text-accent-secondary'
                    : vl.type === 'comment'
                      ? 'text-text-muted'
                      : 'text-text-secondary'
              }
            >
              {vl.text}
            </span>
            {/* Blinking cursor on current typing line */}
            {i === currentLineIdx && isTyping && !vl.done && (
              <span className="inline-block w-[7px] h-[14px] bg-accent-primary/80 ml-[1px] align-middle animate-pulse" />
            )}
          </div>
        ))}
        {/* Cursor on empty new line when waiting */}
        {isTyping && (visibleLines.length === 0 || visibleLines[visibleLines.length - 1]?.done) && (
          <div className="min-h-[1.4em]">
            <span className="inline-block w-[7px] h-[14px] bg-accent-primary/80 animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Preset sequences ── */

export const SETUP_SEQUENCE_DOCKER: TerminalLine[] = [
  { type: 'cmd', text: 'docker compose up -d', delay: 600 },
  { type: 'output', text: 'Creating weaviate ... done', delay: 300 },
  { type: 'success', text: '✓ Weaviate running on localhost:8080', delay: 200 },
  { type: 'cmd', text: 'pip install vectorwave', delay: 600 },
  { type: 'output', text: 'Installing vectorwave-1.2.0...', delay: 200 },
  { type: 'success', text: '✓ Successfully installed vectorwave', delay: 300 },
  { type: 'cmd', text: 'cat .env', delay: 500 },
  { type: 'output', text: 'WEAVIATE_URL=http://localhost:8080' },
  { type: 'output', text: 'VECTORWAVE_VECTORIZER=huggingface' },
  { type: 'cmd', text: 'python -c "from vectorwave import initialize_database; initialize_database()"', delay: 500 },
  { type: 'success', text: '✓ Created: Functions', delay: 150 },
  { type: 'success', text: '✓ Created: Executions', delay: 100 },
  { type: 'success', text: '✓ Created: GoldenDataset', delay: 100 },
  { type: 'success', text: '✓ Created: TokenUsage', delay: 100 },
  { type: 'cmd', text: 'python app.py', delay: 500 },
  { type: 'output', text: '@vectorize wrapping hello()...' },
  { type: 'success', text: 'Hello, World!' },
];

export const SETUP_SEQUENCE_WCS: TerminalLine[] = [
  { type: 'cmd', text: 'pip install vectorwave', delay: 600 },
  { type: 'output', text: 'Installing vectorwave-1.2.0...', delay: 200 },
  { type: 'success', text: '✓ Successfully installed vectorwave', delay: 300 },
  { type: 'cmd', text: 'cat .env', delay: 500 },
  { type: 'output', text: 'WEAVIATE_URL=https://my-cluster.weaviate.network' },
  { type: 'output', text: 'WEAVIATE_API_KEY=ak-••••••••' },
  { type: 'output', text: 'VECTORWAVE_VECTORIZER=huggingface' },
  { type: 'cmd', text: 'python -c "from vectorwave import initialize_database; initialize_database()"', delay: 500 },
  { type: 'success', text: '✓ Created: Functions', delay: 150 },
  { type: 'success', text: '✓ Created: Executions', delay: 100 },
  { type: 'success', text: '✓ Created: GoldenDataset', delay: 100 },
  { type: 'success', text: '✓ Created: TokenUsage', delay: 100 },
  { type: 'cmd', text: 'python app.py', delay: 500 },
  { type: 'output', text: '@vectorize wrapping hello()...' },
  { type: 'success', text: 'Hello, World!' },
];

export const SETUP_SEQUENCE_INTRO: TerminalLine[] = [
  { type: 'comment', text: '# Install VectorWave', delay: 400 },
  { type: 'cmd', text: 'pip install vectorwave', delay: 300 },
  { type: 'success', text: '✓ Installed', delay: 400 },
  { type: 'comment', text: '# Initialize database', delay: 400 },
  { type: 'cmd', text: 'python -c "from vectorwave import initialize_database; initialize_database()"', delay: 300 },
  { type: 'success', text: '✓ 4 collections created', delay: 400 },
  { type: 'comment', text: '# Use the decorator', delay: 400 },
  { type: 'cmd', text: 'python app.py', delay: 300 },
  { type: 'output', text: '@vectorize wrapping hello()...' },
  { type: 'success', text: 'Hello, World!' },
];
