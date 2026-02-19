'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Archive, Download, Database, Sparkles, Code, Filter } from 'lucide-react';
import { archiveService } from '@/services/archive';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export default function ArchivePage() {
  const { t } = useTranslation();
  const [functionName, setFunctionName] = useState<string>('');
  const [includeGolden, setIncludeGolden] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { data: preview, isLoading } = useQuery({
    queryKey: ['archivePreview', functionName, includeGolden],
    queryFn: () => archiveService.preview({
      function_name: functionName || undefined,
      include_golden: includeGolden,
    }),
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await archiveService.exportDownload({
        function_name: functionName || undefined,
        include_golden: includeGolden,
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-accent-primary/10">
          <Archive size={24} className="text-accent-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">{t('archive.title')}</h1>
          <p className="text-sm text-text-muted">{t('archive.description')}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={functionName}
          onChange={(e) => setFunctionName(e.target.value)}
          className="bg-bg-card border border-border-default rounded-xl px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
        >
          <option value="">{t('archive.allFunctions')}</option>
          {preview?.function_names?.map((fn) => (
            <option key={fn} value={fn}>{fn}</option>
          ))}
        </select>

        <label className="flex items-center gap-2 px-3 py-2 bg-bg-card border border-border-default rounded-xl text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={includeGolden}
            onChange={(e) => setIncludeGolden(e.target.checked)}
            className="rounded"
          />
          <Sparkles size={14} className="text-accent-primary" />
          <span className="text-text-secondary">{t('archive.includeGolden')}</span>
        </label>
      </div>

      {/* Stats Cards */}
      {isLoading ? (
        <div className="text-center py-12 text-text-muted text-sm">{t('common.loading')}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: t('archive.totalRecords'), value: preview?.total_records ?? 0, icon: Database },
              { label: t('archive.executions'), value: preview?.execution_count ?? 0, icon: Code },
              { label: t('archive.goldenData'), value: preview?.golden_count ?? 0, icon: Sparkles },
              { label: t('archive.functions'), value: preview?.unique_functions ?? 0, icon: Filter },
            ].map((stat) => (
              <div key={stat.label} className="bg-bg-card border border-border-default rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon size={14} className="text-accent-primary" />
                  <span className="text-xs text-text-muted">{stat.label}</span>
                </div>
                <p className="text-2xl font-bold text-text-primary">{stat.value.toLocaleString()}</p>
              </div>
            ))}
          </div>

          {/* JSONL Preview */}
          {preview?.samples && preview.samples.length > 0 ? (
            <div className="bg-bg-card border border-border-default rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border-default flex items-center gap-2">
                <Code size={14} className="text-accent-primary" />
                <h3 className="text-sm font-medium text-text-primary">{t('archive.preview')}</h3>
                <span className="text-xs text-text-muted ml-auto">
                  {preview.samples.length} {t('archive.sampleEntry')}
                </span>
              </div>
              <div className="p-5 space-y-3">
                {preview.samples.map((sample, i) => (
                  <pre
                    key={i}
                    className="bg-bg-elevated border border-border-default rounded-xl p-4 text-xs text-text-secondary font-mono overflow-x-auto"
                  >
                    {JSON.stringify(sample, null, 2)}
                  </pre>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Archive size={40} className="mx-auto mb-3 text-text-muted opacity-30" />
              <p className="text-sm text-text-muted">{t('archive.noData')}</p>
            </div>
          )}

          {/* Export Button */}
          <div className="flex justify-end">
            <button
              onClick={handleExport}
              disabled={isExporting || !preview?.total_records}
              className={cn(
                'flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all',
                preview?.total_records
                  ? 'bg-accent-primary text-white hover:opacity-90'
                  : 'bg-bg-elevated text-text-muted cursor-not-allowed'
              )}
            >
              <Download size={16} />
              {isExporting ? t('archive.exporting') : t('archive.exportJsonl')}
              {preview?.total_records ? ` (${preview.total_records.toLocaleString()})` : ''}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
