import React, { useState, useEffect } from 'react';
import { Search, Loader2, X, FileText } from 'lucide-react';
import { AppConfig } from '../hooks/useConfig';
import { getRepoTree, getBlobContent } from '../lib/github';
import { decryptLine } from '../lib/crypto';
import { i18n } from '../lib/i18n';

interface SearchPanelProps {
  config: AppConfig;
  onClose: () => void;
  onSelectFile: (filePath: string) => void;
}

interface SearchResult {
  filePath: string;
  line: number;
  content: string;
}

export function SearchPanel({ config, onClose, onSelectFile }: SearchPanelProps) {
  const t = i18n[config.language || 'en'];
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState('');

  const isGithubConfigured = Boolean(config.githubToken && config.repoUrl && config.branch);

  const executeSearch = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    setResults([]);
    setError('');
    
    try {
      const found: SearchResult[] = [];
      const lowerQuery = query.toLowerCase();

      if (isGithubConfigured) {
        // Get all files from github
        const tree = await getRepoTree(config);
        // Filter out .keep dummy files
        const files = tree.filter(f => f.type === 'blob' && f.path && !f.path.endsWith('.keep'));
        
        setProgress({ current: 0, total: files.length });
        
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          try {
            const fetched = await getBlobContent(config, file.sha);
            if (fetched) {
              const lines = fetched.split('\n');
              lines.forEach((line, lineIndex) => {
                if (!line.trim()) return;
                try {
                  const dec = config.encryptionKey ? decryptLine(line, config.encryptionKey) : line;
                  if (dec.toLowerCase().includes(lowerQuery)) {
                    found.push({
                      filePath: file.path,
                      line: lineIndex + 1,
                      content: dec
                    });
                  }
                } catch (e) {
                  // Ignore decryption errors, fallback to checking raw line
                  if (line.toLowerCase().includes(lowerQuery)) {
                    found.push({
                      filePath: file.path,
                      line: lineIndex + 1,
                      content: line
                    });
                  }
                }
              });
            }
          } catch (e) {
            console.error('Failed to search file', file.path, e);
          }
          setProgress({ current: i + 1, total: files.length });
        }
      } else {
        // Local files search
        const localFilesStr = localStorage.getItem('cryptext_local_files') || '[]';
        const localFiles: string[] = JSON.parse(localFilesStr);
        if (config.filePath && !localFiles.includes(config.filePath)) {
          localFiles.push(config.filePath);
        }
        
        const files = localFiles.filter(path => !path.endsWith('.keep'));
        setProgress({ current: 0, total: files.length });
        
        for (let i = 0; i < files.length; i++) {
          const filePath = files[i];
          const content = localStorage.getItem('file:' + filePath) || '';
          if (content) {
            const lines = content.split('\n');
            lines.forEach((line, lineIndex) => {
              if (!line.trim()) return;
              try {
                const dec = config.encryptionKey ? decryptLine(line, config.encryptionKey) : line;
                if (dec.toLowerCase().includes(lowerQuery)) {
                  found.push({
                    filePath,
                    line: lineIndex + 1,
                    content: dec
                  });
                }
              } catch (e) {
                if (line.toLowerCase().includes(lowerQuery)) {
                  found.push({
                    filePath,
                    line: lineIndex + 1,
                    content: line
                  });
                }
              }
            });
          }
          setProgress({ current: i + 1, total: files.length });
        }
      }
      
      setResults(found);
    } catch (e: any) {
      setError(e.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      if (query.length >= 2) {
        executeSearch();
      } else {
        setResults([]);
      }
    }, 800);
    return () => clearTimeout(handler);
  }, [query]);

  return (
    <div className="absolute left-64 top-14 w-96 max-h-[80vh] flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-2xl z-50 overflow-hidden">
      <div className="flex items-center gap-2 p-3 border-b border-zinc-200 dark:border-zinc-800">
        <Search className="w-4 h-4 text-zinc-400" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search all files..."
          className="flex-1 bg-transparent text-sm focus:outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
        />
        {loading && <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />}
        <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
          <X className="w-4 h-4" />
        </button>
      </div>
      
      {loading && progress.total > 0 && (
        <div className="px-3 py-2 text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-800/50">
          Searching {progress.current} / {progress.total} files...
        </div>
      )}
      
      {error && <div className="p-3 text-sm text-red-500">{error}</div>}
      
      <div className="flex-1 overflow-y-auto max-h-[60vh]">
        {!loading && query.length > 0 && results.length === 0 && (
          <div className="p-6 text-center text-sm text-zinc-500">No results found</div>
        )}
        
        {results.map((r, i) => (
          <div 
            key={i} 
            className="p-3 border-b border-zinc-100 dark:border-zinc-800/50 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800"
            onClick={() => {
              onSelectFile(r.filePath);
              onClose();
            }}
          >
            <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-1">
              <FileText className="w-3 h-3" />
              {r.filePath} <span className="text-zinc-400 ml-1">:{r.line}</span>
            </div>
            <div className="text-sm text-zinc-700 dark:text-zinc-300 font-mono truncate">
              {r.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
