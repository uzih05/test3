'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Github,
  Loader2,
  Search,
  GitPullRequest,
  Eye,
  Lock,
  Globe,
  ChevronRight,
  ArrowLeft,
  Plus,
  Minus,
  FileCode,
  ExternalLink,
  X,
  KeyRound,
} from 'lucide-react';
import { githubService } from '@/services/github';
import { useTranslation } from '@/lib/i18n';
import { timeAgo, cn } from '@/lib/utils';
import type { GitHubRepo, GitHubPR, GitHubPRDetail } from '@/types';

type PageView = 'connect' | 'repos' | 'pulls' | 'detail';

export default function GitHubPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [view, setView] = useState<PageView>('repos');
  const [tokenInput, setTokenInput] = useState('');
  const [repoSearch, setRepoSearch] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<{ owner: string; repo: string } | null>(null);
  const [prFilter, setPrFilter] = useState<'open' | 'closed' | 'all'>('open');
  const [selectedPR, setSelectedPR] = useState<number | null>(null);

  // GitHub connection status
  const { data: status, isLoading: loadingStatus } = useQuery({
    queryKey: ['githubStatus'],
    queryFn: () => githubService.status(),
  });

  // Repos
  const { data: reposData, isLoading: loadingRepos } = useQuery({
    queryKey: ['githubRepos'],
    queryFn: () => githubService.repos(1, 50),
    enabled: !!status?.connected,
  });

  // PRs
  const { data: prsData, isLoading: loadingPRs } = useQuery({
    queryKey: ['githubPRs', selectedRepo?.owner, selectedRepo?.repo, prFilter],
    queryFn: () =>
      githubService.pulls(selectedRepo!.owner, selectedRepo!.repo, prFilter === 'all' ? undefined : prFilter),
    enabled: !!selectedRepo,
  });

  // PR Detail
  const { data: prDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ['githubPRDetail', selectedRepo?.owner, selectedRepo?.repo, selectedPR],
    queryFn: () =>
      githubService.pullDetail(selectedRepo!.owner, selectedRepo!.repo, selectedPR!),
    enabled: !!selectedRepo && selectedPR !== null,
  });

  // Save token
  const saveMutation = useMutation({
    mutationFn: () => githubService.saveToken(tokenInput),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['githubStatus'] });
      queryClient.invalidateQueries({ queryKey: ['githubRepos'] });
      setTokenInput('');
      setView('repos');
    },
  });

  // Delete token
  const deleteMutation = useMutation({
    mutationFn: () => githubService.deleteToken(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['githubStatus'] });
      setSelectedRepo(null);
      setSelectedPR(null);
    },
  });

  const connected = status?.connected;
  const repos = reposData?.items || [];
  const prs = prsData?.items || [];

  const filteredRepos = repoSearch
    ? repos.filter((r) => r.full_name.toLowerCase().includes(repoSearch.toLowerCase()))
    : repos;

  if (loadingStatus) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 size={28} className="animate-spin text-neon-lime" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {(selectedRepo || view === 'connect') && (
            <button
              onClick={() => {
                if (selectedPR !== null) {
                  setSelectedPR(null);
                } else if (selectedRepo) {
                  setSelectedRepo(null);
                } else {
                  setView('repos');
                }
              }}
              className="p-1.5 text-text-muted hover:text-text-primary transition-colors"
              aria-label={t('common.back')}
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <h1 className="text-xl font-bold text-text-primary">{t('github.title')}</h1>
          {selectedRepo && (
            <span className="text-sm text-text-muted">
              / {selectedRepo.owner}/{selectedRepo.repo}
              {selectedPR !== null && ` / #${selectedPR}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {connected && (
            <>
              <span className="text-xs text-text-muted">
                Connected as <span className="text-neon-lime font-medium">{status?.username}</span>
              </span>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="px-3 py-1.5 text-xs text-neon-red hover:bg-neon-red-dim rounded-[10px] transition-colors"
              >
                {t('github.disconnect')}
              </button>
            </>
          )}
          {!connected && view !== 'connect' && (
            <button
              onClick={() => setView('connect')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neon-lime text-text-inverse rounded-[10px] text-xs font-medium hover:brightness-110 transition-[opacity,filter]"
            >
              <KeyRound size={14} />
              {t('github.connect')}
            </button>
          )}
        </div>
      </div>

      {/* Not connected → Connect view */}
      {!connected && view !== 'connect' ? (
        <div className="bg-bg-card border border-dashed border-border-default rounded-[20px] p-16 text-center card-shadow">
          <Github size={40} className="mx-auto mb-4 text-text-muted opacity-40" />
          <h2 className="text-lg font-semibold text-text-primary mb-2">Connect GitHub</h2>
          <p className="text-sm text-text-muted mb-6 max-w-md mx-auto">
            Link your GitHub account to browse repositories and review pull requests directly from VectorSurfer.
          </p>
          <button
            onClick={() => setView('connect')}
            className="px-5 py-2.5 bg-neon-lime text-text-inverse rounded-[12px] text-sm font-medium hover:brightness-110 transition-[opacity,filter]"
          >
            Connect with Token
          </button>
        </div>
      ) : view === 'connect' ? (
        /* Token input */
        <div className="max-w-lg mx-auto">
          <div className="bg-bg-card border border-border-default rounded-[20px] p-6 card-shadow">
            <div className="flex items-center gap-2 mb-4">
              <KeyRound size={16} className="text-neon-lime" />
              <h3 className="text-sm font-medium text-text-primary">GitHub Personal Access Token</h3>
            </div>
            <p className="text-xs text-text-muted mb-4">
              Generate a token with <code className="text-neon-cyan">repo</code> scope from GitHub Settings &rarr; Developer Settings &rarr; Personal Access Tokens.
            </p>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              className={cn(
                'w-full px-4 py-2.5 bg-bg-input border border-border-default rounded-[12px]',
                'text-sm text-text-primary placeholder:text-text-muted font-mono',
                'focus:border-neon-lime focus:ring-1 focus:ring-neon-lime/30 outline-none transition-colors'
              )}
            />
            {saveMutation.isError && (
              <p className="text-xs text-neon-red mt-2">
                {(saveMutation.error as Error).message || 'Failed to save token'}
              </p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setView('repos')}
                className="px-4 py-2 text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={!tokenInput || saveMutation.isPending}
                className="px-4 py-2 bg-neon-lime text-text-inverse rounded-[10px] text-xs font-medium hover:brightness-110 disabled:opacity-40 transition-[opacity,filter]"
              >
                {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : 'Save Token'}
              </button>
            </div>
          </div>
        </div>
      ) : selectedPR !== null && selectedRepo ? (
        /* PR Detail */
        <PRDetailView detail={prDetail} loading={loadingDetail} />
      ) : selectedRepo ? (
        /* PR List */
        <div className="space-y-4">
          {/* Filter tabs */}
          <div className="flex items-center gap-2">
            <GitPullRequest size={14} className="text-text-muted" />
            <span className="text-sm text-text-secondary font-medium">{t('github.prs')}</span>
            <div className="flex gap-1 ml-2 bg-bg-card rounded-[10px] p-0.5 border border-border-default">
              {(['open', 'closed', 'all'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setPrFilter(f)}
                  className={cn(
                    'px-2.5 py-1 rounded-[8px] text-xs font-medium transition-colors capitalize',
                    prFilter === f ? 'bg-neon-lime text-text-inverse' : 'text-text-muted hover:text-text-primary'
                  )}
                >
                  {f === 'all' ? 'All' : t(`github.${f}`)}
                </button>
              ))}
            </div>
          </div>

          {/* PR list */}
          <div className="bg-bg-card border border-border-default rounded-[20px] overflow-hidden card-shadow">
            {loadingPRs ? (
              <div className="flex justify-center py-12">
                <Loader2 size={20} className="animate-spin text-neon-lime" />
              </div>
            ) : prs.length === 0 ? (
              <div className="text-center py-12 text-sm text-text-muted">No pull requests found</div>
            ) : (
              <div className="divide-y divide-border-default">
                {prs.map((pr) => (
                  <PRRow key={pr.number} pr={pr} onClick={() => setSelectedPR(pr.number)} />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Repo List */
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={repoSearch}
              onChange={(e) => setRepoSearch(e.target.value)}
              placeholder={t('github.selectRepo')}
              className={cn(
                'w-full pl-9 pr-4 py-2.5 bg-bg-input border border-border-default rounded-[12px]',
                'text-sm text-text-primary placeholder:text-text-muted',
                'focus:border-neon-lime focus:ring-1 focus:ring-neon-lime/30 outline-none transition-colors'
              )}
            />
          </div>

          {loadingRepos ? (
            <div className="flex justify-center py-12">
              <Loader2 size={20} className="animate-spin text-neon-lime" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredRepos.map((repo) => (
                <button
                  key={repo.full_name}
                  onClick={() => setSelectedRepo({ owner: repo.owner, repo: repo.name })}
                  className="bg-bg-card border border-border-default rounded-[16px] p-5 text-left hover:border-border-hover hover:bg-bg-card-hover transition-[border-color,background-color] group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {repo.private ? (
                        <Lock size={14} className="text-neon-orange shrink-0" />
                      ) : (
                        <Globe size={14} className="text-neon-cyan shrink-0" />
                      )}
                      <span className="text-sm font-medium text-text-primary truncate">{repo.name}</span>
                    </div>
                    <ChevronRight size={14} className="text-text-muted group-hover:text-neon-lime transition-colors shrink-0" />
                  </div>
                  <p className="text-[11px] text-text-muted mb-1">{repo.owner}</p>
                  {repo.description && (
                    <p className="text-xs text-text-muted line-clamp-2 mb-2">{repo.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-[10px] text-text-muted">
                    {repo.language && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-neon-lime" />
                        {repo.language}
                      </span>
                    )}
                    <span>{timeAgo(repo.updated_at)}</span>
                  </div>
                </button>
              ))}
              {filteredRepos.length === 0 && (
                <div className="col-span-full text-center py-12 text-sm text-text-muted">
                  No repositories found
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* === PR Row === */
function PRRow({ pr, onClick }: { pr: GitHubPR; onClick: () => void }) {
  const stateColor =
    pr.state === 'open'
      ? 'text-neon-lime'
      : pr.state === 'merged'
        ? 'text-[#a855f7]'
        : 'text-neon-red';

  const stateBg =
    pr.state === 'open'
      ? 'bg-neon-lime-dim'
      : pr.state === 'merged'
        ? 'bg-[rgba(168,85,247,0.15)]'
        : 'bg-neon-red-dim';

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-5 py-3.5 hover:bg-bg-card-hover cursor-pointer transition-colors"
    >
      <GitPullRequest size={16} className={stateColor} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium text-text-primary truncate">{pr.title}</span>
          {pr.draft && (
            <span className="text-[10px] px-1.5 py-0.5 bg-bg-elevated rounded-md text-text-muted">Draft</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-text-muted">
          <span>#{pr.number}</span>
          <span>{pr.author}</span>
          <span>{timeAgo(pr.created_at)}</span>
        </div>
      </div>
      {/* Labels */}
      {(pr.labels || []).length > 0 && (
        <div className="flex gap-1 shrink-0">
          {(pr.labels || []).slice(0, 3).map((label) => (
            <span
              key={label.name}
              className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
              style={{
                background: `#${label.color}22`,
                color: `#${label.color}`,
              }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}
      <span className={cn('text-[10px] px-2 py-0.5 rounded-[8px] font-semibold capitalize', stateBg, stateColor)}>
        {pr.state}
      </span>
      <ChevronRight size={14} className="text-text-muted shrink-0" />
    </div>
  );
}

/* === PR Detail View === */
function PRDetailView({ detail, loading }: { detail?: GitHubPRDetail; loading: boolean }) {
  if (loading || !detail) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={24} className="animate-spin text-neon-lime" />
      </div>
    );
  }

  const stateColor =
    detail.state === 'open'
      ? 'text-neon-lime'
      : detail.state === 'merged'
        ? 'text-[#a855f7]'
        : 'text-neon-red';

  const stateBg =
    detail.state === 'open'
      ? 'bg-neon-lime-dim'
      : detail.state === 'merged'
        ? 'bg-[rgba(168,85,247,0.15)]'
        : 'bg-neon-red-dim';

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="bg-bg-card border border-border-default rounded-[20px] p-6 card-shadow">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-text-primary mb-1">{detail.title}</h2>
            <div className="flex items-center gap-3 text-xs text-text-muted">
              <span className={cn('px-2 py-0.5 rounded-[8px] font-semibold capitalize', stateBg, stateColor)}>
                {detail.state}
              </span>
              <span>#{detail.number}</span>
              <span className="flex items-center gap-1">
                {detail.author_avatar && (
                  <img src={detail.author_avatar} alt="" className="w-4 h-4 rounded-full" />
                )}
                {detail.author}
              </span>
              <span>{timeAgo(detail.created_at)}</span>
              {detail.draft && <span className="text-neon-orange">Draft</span>}
            </div>
          </div>
          <a
            href={detail.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-text-muted hover:text-neon-lime transition-colors shrink-0"
            aria-label="Open in GitHub"
          >
            <ExternalLink size={16} />
          </a>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-bg-elevated rounded-[12px] p-3 text-center">
            <FileCode size={14} className="mx-auto mb-1 text-text-muted" />
            <p className="text-lg font-bold text-text-primary">{detail.changed_files}</p>
            <p className="text-[10px] text-text-muted">Files Changed</p>
          </div>
          <div className="bg-bg-elevated rounded-[12px] p-3 text-center">
            <Plus size={14} className="mx-auto mb-1 text-neon-lime" />
            <p className="text-lg font-bold text-neon-lime">+{detail.additions}</p>
            <p className="text-[10px] text-text-muted">Additions</p>
          </div>
          <div className="bg-bg-elevated rounded-[12px] p-3 text-center">
            <Minus size={14} className="mx-auto mb-1 text-neon-red" />
            <p className="text-lg font-bold text-neon-red">-{detail.deletions}</p>
            <p className="text-[10px] text-text-muted">Deletions</p>
          </div>
        </div>
      </div>

      {/* Labels & Reviewers */}
      {((detail.labels || []).length > 0 || (detail.reviewers || []).length > 0) && (
        <div className="bg-bg-card border border-border-default rounded-[20px] p-5 card-shadow">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(detail.labels || []).length > 0 && (
              <div>
                <p className="text-xs text-text-muted mb-2">Labels</p>
                <div className="flex flex-wrap gap-1.5">
                  {(detail.labels || []).map((label) => (
                    <span
                      key={label.name}
                      className="text-xs px-2 py-0.5 rounded-md font-medium"
                      style={{
                        background: `#${label.color}22`,
                        color: `#${label.color}`,
                      }}
                    >
                      {label.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {(detail.reviewers || []).length > 0 && (
              <div>
                <p className="text-xs text-text-muted mb-2">Reviewers</p>
                <div className="flex flex-wrap gap-2">
                  {(detail.reviewers || []).map((r) => (
                    <span key={r} className="text-xs text-text-secondary bg-bg-elevated px-2 py-1 rounded-[8px]">
                      <Eye size={10} className="inline mr-1" />{r}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Body */}
      {detail.body && (
        <div className="bg-bg-card border border-border-default rounded-[20px] p-5 card-shadow">
          <p className="text-xs text-text-muted mb-3">Description</p>
          <div className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
            {detail.body}
          </div>
        </div>
      )}
    </div>
  );
}
