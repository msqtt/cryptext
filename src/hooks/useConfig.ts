import { useState, useEffect } from 'react';

export type ThemeOption = 'system' | 'light' | 'dark';
export type LanguageOption = 'en' | 'zh';

export interface AppConfig {
  githubToken: string;
  repoUrl: string;
  filePath: string;
  branch: string;
  encryptionKey: string;
  theme: ThemeOption;
  language: LanguageOption;
  vimMode?: boolean;
  vimKeyBindings?: string;
}

const defaultConfig: AppConfig = {
  githubToken: '',
  repoUrl: '',
  filePath: 'notes.txt',
  branch: 'main',
  encryptionKey: '',
  theme: 'system',
  language: 'en',
  vimMode: false,
  vimKeyBindings: 'imap jk <Esc>\n'
};

export function useConfig() {
  const [config, setConfig] = useState<AppConfig>(() => {
    const saved = localStorage.getItem('app-config');
    if (saved) {
      try {
        return { ...defaultConfig, ...JSON.parse(saved) };
      } catch (e) {
        console.error('Failed to parse saved config', e);
      }
    }
    return defaultConfig;
  });

  useEffect(() => {
    localStorage.setItem('app-config', JSON.stringify(config));
  }, [config]);

  const updateConfig = (newConfig: Partial<AppConfig>) => {
    setConfig((prev) => ({ ...prev, ...newConfig }));
  };

  return { config, updateConfig };
}
