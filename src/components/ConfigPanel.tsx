import React from 'react';
import { AppConfig } from '../hooks/useConfig';
import { Save, Settings2, Github, Key, FileText, GitBranch, User, Monitor, Globe } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { i18n } from '../lib/i18n';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ConfigPanelProps {
  config: AppConfig;
  updateConfig: (config: Partial<AppConfig>) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function ConfigPanel({ config, updateConfig, isOpen, onClose }: ConfigPanelProps) {
  const t = i18n[config.language || 'en'];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    updateConfig({ [e.target.name]: e.target.value });
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-y-0 right-0 w-full sm:w-80 bg-zinc-50 dark:bg-[#0F1115] border-l border-zinc-200 dark:border-[#2D3139] shadow-2xl z-50 flex flex-col transform transition-transform duration-300 text-zinc-900 dark:text-[#E0E0E0]">
      <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-[#2D3139] bg-white dark:bg-[#16191E]">
        <h2 className="font-semibold flex items-center gap-2">
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
          <h3 className="text-xs font-semibold text-zinc-500 dark:text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Globe className="w-4 h-4" />
            General
          </h3>

          <div className="flex items-center justify-between">
            <label className="text-sm text-zinc-600 dark:text-gray-400">Vim Mode</label>
            <input
              type="checkbox"
              name="vimMode"
              checked={!!config.vimMode}
              onChange={(e) => updateConfig({ vimMode: e.target.checked })}
              className="w-4 h-4 text-indigo-600 bg-white border-zinc-300 rounded focus:ring-indigo-500"
            />
          </div>

          {config.vimMode && (
            <div className="space-y-2">
              <label className="text-xs text-zinc-600 dark:text-gray-400 block ml-1">Vim Custom Mappings</label>
              <textarea
                name="vimKeyBindings"
                value={config.vimKeyBindings || ''}
                onChange={(e) => updateConfig({ vimKeyBindings: e.target.value })}
                placeholder="imap jk <Esc>"
                className="w-full bg-white dark:bg-[#16191E] border border-zinc-200 dark:border-[#2D3139] rounded-md py-2 px-3 text-sm font-mono text-zinc-900 dark:text-[#E0E0E0] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                rows={3}
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs text-zinc-600 dark:text-gray-400 block ml-1">{t.theme}</label>
            <div className="relative">
              <select
                name="theme"
                value={config.theme}
                onChange={handleChange}
                className="w-full bg-white dark:bg-[#16191E] border border-zinc-200 dark:border-[#2D3139] rounded-md py-2 px-3 text-sm text-zinc-900 dark:text-[#E0E0E0] focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none"
              >
                <option value="system">{t.autoDetect}</option>
                <option value="light">{t.light}</option>
                <option value="dark">{t.dark}</option>
              </select>
              <Monitor className="w-4 h-4 absolute right-3 top-2.5 text-zinc-400 dark:text-gray-500 pointer-events-none" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-zinc-600 dark:text-gray-400 block ml-1">{t.language}</label>
            <div className="relative">
              <select
                name="language"
                value={config.language}
                onChange={handleChange}
                className="w-full bg-white dark:bg-[#16191E] border border-zinc-200 dark:border-[#2D3139] rounded-md py-2 px-3 text-sm text-zinc-900 dark:text-[#E0E0E0] focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none"
              >
                <option value="en">English</option>
                <option value="zh">中文</option>
              </select>
              <Globe className="w-4 h-4 absolute right-3 top-2.5 text-zinc-400 dark:text-gray-500 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-[#2D3139]">
          <h3 className="text-xs font-semibold text-zinc-500 dark:text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Github className="w-4 h-4" />
            {t.githubConnection}
          </h3>
          
          <div className="space-y-2">
            <label className="text-xs text-zinc-600 dark:text-gray-400 block ml-1">{t.pat}</label>
            <div className="relative">
              <input
                type="password"
                name="githubToken"
                value={config.githubToken}
                onChange={handleChange}
                placeholder="ghp_..."
                className="w-full bg-white dark:bg-[#16191E] border border-zinc-200 dark:border-[#2D3139] rounded-md py-2 px-3 pl-9 text-sm text-zinc-900 dark:text-[#E0E0E0] placeholder:text-zinc-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
              <Key className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400 dark:text-gray-500" />
            </div>
            <p className="text-[10px] text-zinc-500 dark:text-gray-500 ml-1">{t.patHelp}</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-zinc-600 dark:text-gray-400 block ml-1">{t.repoUrl}</label>
            <div className="relative">
              <input
                type="text"
                name="repoUrl"
                value={config.repoUrl}
                onChange={handleChange}
                placeholder="https://github.com/user/repo"
                className="w-full bg-white dark:bg-[#16191E] border border-zinc-200 dark:border-[#2D3139] rounded-md py-2 px-3 pl-9 text-sm text-zinc-900 dark:text-[#E0E0E0] placeholder:text-zinc-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
              <Github className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400 dark:text-gray-500" />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs text-zinc-600 dark:text-gray-400 block ml-1">{t.branch}</label>
             <div className="relative">
              <input
                type="text"
                name="branch"
                value={config.branch}
                onChange={handleChange}
                placeholder="main"
                className="w-full bg-white dark:bg-[#16191E] border border-zinc-200 dark:border-[#2D3139] rounded-md py-2 px-3 pl-9 text-sm text-zinc-900 dark:text-[#E0E0E0] placeholder:text-zinc-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
              <GitBranch className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400 dark:text-gray-500" />
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-[#2D3139]">
          <h3 className="text-xs font-semibold text-zinc-500 dark:text-gray-500 uppercase tracking-wider flex items-center gap-2">
             <Key className="w-4 h-4" />
            {t.encryption}
          </h3>
          <div className="space-y-2">
            <label className="text-xs text-zinc-600 dark:text-gray-400 block ml-1">{t.encryptionKey}</label>
             <input
              type="password"
              name="encryptionKey"
              value={config.encryptionKey}
              onChange={handleChange}
              placeholder="Your secret key"
              className="w-full bg-white dark:bg-[#16191E] border border-zinc-200 dark:border-[#2D3139] rounded-md py-2 px-3 text-sm text-zinc-900 dark:text-[#E0E0E0] placeholder:text-zinc-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
            />
            <p className="text-[10px] text-zinc-500 dark:text-gray-500 ml-1">{t.encryptionHelp}</p>
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
