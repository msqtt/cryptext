import React, { useEffect, useState } from 'react';
import { getFileHistory, fetchFileVersion } from '../lib/github';
import { AppConfig } from '../hooks/useConfig';
import { format } from 'date-fns';
import { History, GitCommit, ChevronRight, X } from 'lucide-react';
import { i18n } from '../lib/i18n';

interface HistoryPanelProps {
  config: AppConfig;
  isOpen: boolean;
  onClose: () => void;
  onSelectVersion: (content: string, sha: string) => void;
  currentSha: string | null;
}

export function HistoryPanel({ config, isOpen, onClose, onSelectVersion, currentSha }: HistoryPanelProps) {
  const [commits, setCommits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scope, setScope] = useState<'file' | 'repo'>('file');
  
  const t = i18n[config.language || 'en'] as any;

  useEffect(() => {
    if (isOpen) {
      if (!config.filePath && scope === 'file') {
        setScope('repo');
      } else {
        loadHistory();
      }
    }
  }, [isOpen, scope, config.filePath]); // Added config.filePath and scope to dependencies

  const loadHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const isRepoLevel = scope === 'repo' || !config.filePath;
      const history = await getFileHistory(config, isRepoLevel);
      setCommits(history);
    } catch (e: any) {
      setError(e.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (commitSha: string) => {
    if (!config.filePath) {
      setError('No file is currently selected.');
      return;
    }
    setLoading(true);
    try {
      const file = await fetchFileVersion(config, commitSha);
      if (file) {
        onSelectVersion(file.content, file.sha);
        onClose();
      } else {
        setError(`This file didn't exist in that commit.`);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load version');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-y-0 right-0 w-full sm:w-80 bg-zinc-50 dark:bg-[#0F1115] border-l border-zinc-200 dark:border-[#2D3139] shadow-2xl z-50 flex flex-col transform transition-transform duration-300 text-zinc-900 dark:text-[#E0E0E0]">
      <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-[#2D3139] bg-white dark:bg-[#16191E] shrink-0">
        <h2 className="font-semibold flex items-center gap-2">
          <History className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
          {t.historyTitle}
        </h2>
        <button 
          onClick={onClose} 
          className="text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:hover:text-gray-200 transition-colors p-1"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex border-b border-zinc-200 dark:border-[#2D3139] bg-white dark:bg-[#16191E] text-sm shrink-0">
        <button 
          onClick={() => setScope('file')}
          disabled={!config.filePath}
          className={`flex-1 py-3 text-center border-b-2 transition-colors ${!config.filePath ? 'opacity-50 cursor-not-allowed' : ''} ${scope === 'file' ? 'border-indigo-500 font-medium text-indigo-600 dark:text-indigo-400' : 'border-transparent text-zinc-500 dark:text-gray-400 hover:text-zinc-700 dark:hover:text-gray-300'}`}
        >
          {t.fileHistory || 'File History'}
        </button>
        <button 
          onClick={() => setScope('repo')}
          className={`flex-1 py-3 text-center border-b-2 transition-colors ${scope === 'repo' ? 'border-indigo-500 font-medium text-indigo-600 dark:text-indigo-400' : 'border-transparent text-zinc-500 dark:text-gray-400 hover:text-zinc-700 dark:hover:text-gray-300'}`}
        >
          {t.repoHistory || 'Repo History'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && <div className="text-sm text-zinc-500 text-center py-4">{t.loadingHistory}</div>}
        {error && <div className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded">{error}</div>}
        
        {!loading && !error && commits.length === 0 && (
          <div className="text-sm text-zinc-500 text-center py-4">{t.noHistory}</div>
        )}

        {!loading && commits.map((commit, index) => (
          <button
            key={commit.sha}
            onClick={() => handleSelect(commit.sha)}
            className={`w-full text-left p-3 rounded-md border transition-colors group flex items-start gap-3 
              ${currentSha === commit.sha 
                ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/30' 
                : 'bg-white border-zinc-200 hover:border-indigo-300 dark:bg-[#16191E] dark:border-[#2D3139] dark:hover:border-indigo-500/50'
              }`}
          >
            <GitCommit className="w-4 h-4 mt-0.5 text-zinc-400 dark:text-gray-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-base font-medium truncate mb-1">
                {commit.commit.message || 'Update'}
              </p>
              <div className="flex items-center text-sm text-zinc-500 dark:text-gray-500">
                <span className="truncate">{commit.commit.author?.name}</span>
                <span className="mx-1.5">•</span>
                <span>{format(new Date(commit.commit.author?.date), 'MMM d, HH:mm')}</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-300 dark:text-gray-600 group-hover:text-indigo-400 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}
