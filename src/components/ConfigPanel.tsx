import React, { useEffect, useState, useRef } from 'react';
import { AppConfig } from '../hooks/useConfig';
import { Save, Settings2, Github, Key, FileText, GitBranch, User, Monitor, Globe, Loader2, ChevronDown } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { i18n } from '../lib/i18n';
import { Octokit } from 'octokit';
import { parseRepoInfo } from '../lib/github';

import { CustomSelect } from './CustomSelect';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface StyledSelectProps {
  name: string;
  value: string;
  onChange: (e: any) => void;
  options: { label: string; value: string }[];
  icon?: React.ElementType;
  disabled?: boolean;
  placeholder?: string;
  loading?: boolean;
}

function StyledSelect(props: StyledSelectProps) {
  return <CustomSelect {...props} />;
}

interface ConfigPanelProps {
  config: AppConfig;
  updateConfig: (config: Partial<AppConfig>) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function ConfigPanel({ config, updateConfig, isOpen, onClose }: ConfigPanelProps) {
  const t = i18n[config.language || 'en'];
  const [repos, setRepos] = useState<any[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  useEffect(() => {
    if (config.githubToken) {
      fetchRepos();
    } else {
      setTokenError(null);
    }
  }, [config.githubToken]);

  useEffect(() => {
    if (config.githubToken && config.repoUrl) {
      fetchBranches();
    }
  }, [config.githubToken, config.repoUrl]);

  const fetchBranches = async () => {
    setLoadingBranches(true);
    setTokenError(null);
    setBranches([]);
    try {
      const { owner, repo } = parseRepoInfo(config.repoUrl);
      if (!owner || !repo) return;
      const octokit = new Octokit({ auth: config.githubToken });
      const res = await octokit.rest.repos.listBranches({
        owner,
        repo,
        per_page: 100
      });
      setBranches(res.data);
    } catch (e: any) {
      console.error('Failed to fetch branches', e);
      if (e?.status === 401 || (e?.message && e.message.includes('Bad credentials'))) {
        setTokenError('Bad credentials - Invalid or expired token.');
      }
    } finally {
      setLoadingBranches(false);
    }
  };

  const fetchRepos = async () => {
    setLoadingRepos(true);
    setTokenError(null);
    try {
      const octokit = new Octokit({ auth: config.githubToken });
      const res = await octokit.rest.repos.listForAuthenticatedUser({
        sort: 'updated',
        per_page: 50
      });
      setRepos(res.data);
    } catch (e: any) {
      console.error('Failed to fetch repos', e);
      if (e?.status === 401 || (e?.message && e.message.includes('Bad credentials'))) {
        setTokenError('Bad credentials - Invalid or expired token.');
      } else {
        setTokenError(e?.message || 'Failed to fetch repositories.');
      }
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    updateConfig({ [e.target.name]: e.target.value });
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-y-0 right-0 w-full sm:w-80 bg-zinc-50 dark:bg-[#0F1115] border-l border-zinc-200 dark:border-[#2D3139] shadow-2xl z-50 flex flex-col transform transition-transform duration-300 text-zinc-900 dark:text-[#E0E0E0]">
      <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-[#2D3139] bg-white dark:bg-[#16191E]">
        <h2 className="font-display font-semibold flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
          {t.config}
        </h2>
        <button 
          onClick={onClose} 
          className="text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:hover:text-gray-200 transition-colors p-1"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6">

        {/* Global Settings */}
        <div className="space-y-4">
          <h3 className="text-xs font-display font-semibold text-zinc-500 dark:text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Globe className="w-4 h-4" />
            General
          </h3>

          <div className="flex items-center justify-between">
            <label className="text-base text-zinc-600 dark:text-gray-400">Vim Mode</label>
            <input
              type="checkbox"
              name="vimMode"
              checked={!!config.vimMode}
              onChange={(e) => updateConfig({ vimMode: e.target.checked })}
              className="w-5 h-5 text-indigo-600 bg-white border-zinc-300 rounded focus:ring-indigo-500"
            />
          </div>

          {config.vimMode && (
            <div className="space-y-2">
              <label className="text-sm text-zinc-600 dark:text-gray-400 block ml-1">Vim Custom Mappings</label>
              <textarea
                name="vimKeyBindings"
                value={config.vimKeyBindings || ''}
                onChange={(e) => updateConfig({ vimKeyBindings: e.target.value })}
                placeholder="imap jk <Esc>"
                className="w-full bg-white dark:bg-[#16191E] border border-zinc-200 dark:border-[#2D3139] rounded-md py-2 px-3 text-base font-mono text-zinc-900 dark:text-[#E0E0E0] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                rows={3}
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 dark:text-gray-400 uppercase tracking-wider block ml-1">{t.theme}</label>
            <div className="grid grid-cols-3 gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800">
              {[
                { label: t.autoDetect, value: 'system', icon: Monitor },
                { label: t.light, value: 'light', icon: null },
                { label: t.dark, value: 'dark', icon: null }
              ].map((item) => {
                const active = (config.theme || 'system') === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => updateConfig({ theme: item.value as any })}
                    className={cn(
                      "py-1.5 px-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1 transition-all",
                      active
                        ? "bg-white dark:bg-[#1C1F26] shadow-sm text-indigo-600 dark:text-indigo-400 border border-zinc-200/40 dark:border-zinc-850"
                        : "text-zinc-650 dark:text-gray-400 hover:text-zinc-900 dark:hover:text-gray-200"
                    )}
                  >
                    {item.icon && <item.icon className="w-3.5 h-3.5" />}
                    {item.value === 'light' && <span className="text-xs">☀️</span>}
                    {item.value === 'dark' && <span className="text-xs">🌙</span>}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 dark:text-gray-400 uppercase tracking-wider block ml-1">{t.language}</label>
            <div className="grid grid-cols-2 gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800">
              {[
                { label: 'English', value: 'en' },
                { label: '中文', value: 'zh' }
              ].map((item) => {
                const active = (config.language || 'en') === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => updateConfig({ language: item.value as any })}
                    className={cn(
                      "py-1.5 px-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-center",
                      active
                        ? "bg-white dark:bg-[#1C1F26] shadow-sm text-indigo-600 dark:text-indigo-400 border border-zinc-200/40 dark:border-zinc-850"
                        : "text-zinc-650 dark:text-gray-400 hover:text-zinc-900 dark:hover:text-gray-200"
                    )}
                  >
                    {item.value === 'en' && <span className="text-xs">🇺🇸</span>}
                    {item.value === 'zh' && <span className="text-xs">🇨🇳</span>}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-[#2D3139]">
          <h3 className="text-xs font-display font-semibold text-zinc-500 dark:text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Github className="w-4 h-4" />
            {t.githubConnection}
          </h3>
          
          <div className="space-y-2">
            <label className="text-sm text-zinc-600 dark:text-gray-400 block ml-1">{t.pat}</label>
            <div className="relative">
              <input
                type="password"
                name="githubToken"
                value={config.githubToken || ''}
                onChange={handleChange}
                placeholder="ghp_..."
                className={cn(
                  "w-full bg-white dark:bg-[#16191E] border rounded-md py-2 px-3 pl-9 text-base text-zinc-900 dark:text-[#E0E0E0] placeholder:text-zinc-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-1 font-mono",
                  tokenError ? "border-red-500 focus:ring-red-500" : "border-zinc-200 dark:border-[#2D3139] focus:ring-indigo-500"
                )}
              />
              <Key className="w-4 h-4 absolute left-3 top-3 text-zinc-400 dark:text-gray-500" />
            </div>
            {tokenError && (
              <p className="text-xs text-red-500 dark:text-red-400 ml-1">{tokenError}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm text-zinc-600 dark:text-gray-400 block ml-1">{t.repoUrl}</label>
            <div className="relative">
              {config.githubToken ? (
                <StyledSelect
                  name="repoUrl"
                  options={repos.map(r => ({ label: r.full_name, value: r.html_url }))}
                  value={config.repoUrl || ''}
                  onChange={handleChange}
                  icon={Github}
                  disabled={loadingRepos}
                  placeholder="Select a repository..."
                  loading={loadingRepos}
                />
              ) : (
                <input
                  type="text"
                  name="repoUrl"
                  value={config.repoUrl || ''}
                  onChange={handleChange}
                  placeholder="https://github.com/user/repo"
                  className="w-full bg-white dark:bg-[#16191E] border border-zinc-200 dark:border-[#2D3139] rounded-md py-2 px-3 pl-9 text-base text-zinc-900 dark:text-[#E0E0E0] placeholder:text-zinc-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              )}
              {(!config.githubToken) && <Github className="w-4 h-4 absolute left-3 top-3 text-zinc-400 dark:text-gray-500" />}
            </div>
            {config.githubToken && repos.length === 0 && !loadingRepos && (
              <p className="text-xs text-amber-600 dark:text-amber-400 ml-1">No repositories found.</p>
            )}
          </div>
          
          <div className="space-y-2">
            <label className="text-sm text-zinc-600 dark:text-gray-400 block ml-1">{t.branch}</label>
             <div className="relative">
              {config.githubToken && config.repoUrl ? (
                <StyledSelect
                  name="branch"
                  options={[
                    ...(config.branch && !branches.some(b => b.name === config.branch) ? [{ label: config.branch, value: config.branch }] : []),
                    ...branches.map(b => ({ label: b.name, value: b.name }))
                  ]}
                  value={config.branch || ''}
                  onChange={handleChange}
                  icon={GitBranch}
                  disabled={loadingBranches}
                  placeholder="Select branch..."
                  loading={loadingBranches}
                />
              ) : (
                <>
                  <input
                    type="text"
                    name="branch"
                    value={config.branch || ''}
                    onChange={handleChange}
                    placeholder="main"
                    className="w-full bg-white dark:bg-[#16191E] border border-zinc-200 dark:border-[#2D3139] rounded-md py-2 px-3 pl-9 text-base text-zinc-900 dark:text-[#E0E0E0] placeholder:text-zinc-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                  <GitBranch className="w-4 h-4 absolute left-3 top-3 text-zinc-400 dark:text-gray-500" />
                </>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-[#2D3139]">
          <h3 className="text-xs font-display font-semibold text-zinc-500 dark:text-gray-500 uppercase tracking-wider flex items-center gap-2">
             <Key className="w-4 h-4" />
            {t.encryption}
          </h3>
          <div className="space-y-2">
            <label className="text-sm text-zinc-600 dark:text-gray-400 block ml-1">{t.encryptionKey}</label>
             <input
              type="password"
              name="encryptionKey"
              value={config.encryptionKey}
              onChange={handleChange}
              placeholder="Your secret key"
              className="w-full bg-white dark:bg-[#16191E] border border-zinc-200 dark:border-[#2D3139] rounded-md py-2 px-3 text-base text-zinc-900 dark:text-[#E0E0E0] placeholder:text-zinc-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
            />
            <p className="text-xs text-zinc-500 dark:text-gray-500 ml-1">{t.encryptionHelp}</p>
          </div>
        </div>
      </div>
      
      <div className="p-4 border-t border-zinc-200 dark:border-[#2D3139] bg-white dark:bg-[#16191E]">
        <button 
          onClick={onClose}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md flex items-center justify-center gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <Save className="w-4 h-4" />
          {t.saveAndClose}
        </button>
      </div>
    </div>
  );
}
