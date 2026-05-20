import React, { useState, useEffect, useRef } from 'react';
import { useConfig } from './hooks/useConfig';
import { ConfigPanel } from './components/ConfigPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { FileTree } from './components/FileTree';
import { Editor } from './components/Editor';
import { SearchPanel } from './components/SearchPanel';
import { fetchFileFromGithub, saveFileToGithub } from './lib/github';
import { encryptLine, decryptLine } from './lib/crypto';
import { Settings, CloudDownload, CloudUpload, RefreshCw, AlertCircle, CheckCircle2, History, Type, Columns, Smile, PanelLeftClose, PanelLeft, Search, Eye, Sparkles } from 'lucide-react';
import { i18n } from './lib/i18n';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import EmojiPicker from 'emoji-picker-react';
import { MermaidBlock } from './components/MermaidBlock';
import { PlantUMLBlock } from './components/PlantUMLBlock';
import { ZoomableView } from './components/ZoomableView';
import { WYSIWYGEditor } from './components/WYSIWYGEditor';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';

export default function App() {
  const { config, updateConfig } = useConfig();
  const t = i18n[config.language || 'en'];
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isExplorerOpen, setIsExplorerOpen] = useState(window.innerWidth >= 1024);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [text, setText] = useState('');
  const [originalText, setOriginalText] = useState('__LOADING__');
  const [fileSha, setFileSha] = useState<string | null>(null);
  
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const [viewMode, setViewMode] = useState<'editor' | 'split' | 'wysiwyg' | 'preview'>('editor');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const handleCursorLineChange = (line: number, totalLines: number) => {
    if (viewMode === 'split' && previewContainerRef.current) {
      const container = previewContainerRef.current;
      const ratio = (line - 1) / Math.max(1, totalLines - 1);
      container.scrollTo({
        top: ratio * (container.scrollHeight - container.clientHeight),
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && isExplorerOpen) {
        // Just leave it as is if they explicitly opened it, but usually we'd want it closed on initial resize to mobile
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (config.theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(config.theme);
    }
  }, [config.theme]);

  const handleLoad = async (isManual: boolean = true) => {
    if (!config.githubToken || !config.repoUrl) {
      if (isManual) {
        setErrorMessage(t.errorConfigGithub);
        setStatus('error');
        setIsConfigOpen(true);
      }
      return;
    }

    const isSpecialFile = config.filePath === '.vimrc';

    if (!config.encryptionKey && !isSpecialFile) {
      if (isManual) {
        setErrorMessage(t.errorConfigKey);
        setStatus('error');
        setIsConfigOpen(true);
      }
      return;
    }

    try {
      setStatus('loading');
      const file = await fetchFileFromGithub(config);
      if (file) {
        setFileSha(file.sha);
        
        const lines = file.content.split('\n');
        
        let remoteText = file.content;
        
        if (!isSpecialFile) {
          const decryptedLines = lines.map(line => {
            if (!line.trim()) return '';
            try {
              return decryptLine(line, config.encryptionKey);
            } catch (e) {
              console.error('Failed to decrypt line', line, e);
              return '[[ Decryption Failed ]]';
            }
          });
          remoteText = decryptedLines.join('\n');
        }
        
        setOriginalText(remoteText);
        
        setText(prevText => {
          if (isManual || prevText === '' || prevText === '__LOADING__') {
            if (config.filePath) {
              localStorage.setItem('file:' + config.filePath, remoteText);
            }
            return remoteText;
          }
          return prevText;
        });
      } else {
        setText(prevText => {
          if (isManual || prevText === '__LOADING__') {
            return '';
          }
          return prevText;
        });
        setOriginalText('');
        setFileSha(null);
      }
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (e: any) {
      console.error(e);
      if (isManual) {
        setErrorMessage(e.message || 'Failed to pull from GitHub');
        setStatus('error');
      } else {
        setStatus('idle');
      }
    }
  };

  const handleSave = async (forcePush: boolean = false) => {
    if (!config.githubToken || !config.repoUrl) {
      setErrorMessage(t.errorConfigGithub);
      setStatus('error');
      setIsConfigOpen(true);
      return;
    }

    const isSpecialFile = config.filePath === '.vimrc';

    if (!config.encryptionKey && !isSpecialFile) {
      setErrorMessage(t.errorConfigKey);
      setStatus('error');
      setIsConfigOpen(true);
      return;
    }

    try {
      setStatus('saving');
      
      let contentToSave = text;
      
      if (!isSpecialFile) {
        const lines = text.split('\n');
        const encryptedLines = lines.map(line => {
          if (!line.trim()) return ''; 
          try {
            return encryptLine(line, config.encryptionKey);
          } catch (e) {
            console.error('Failed to encrypt line', line, e);
            return line;
          }
        });
        contentToSave = encryptedLines.join('\n');
      }
      
      const newSha = await saveFileToGithub(config, contentToSave, fileSha);
      setFileSha(newSha);
      setOriginalText(text);
      
      // If we just saved .vimrc in the editor, optionally update the main config too
      if (isSpecialFile) {
        updateConfig({ vimKeyBindings: text });
      }
      
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (e: any) {
      console.error(e);
      let errorMsg = e.message || 'Failed to push to GitHub';
      if (e.status === 422 || e.status === 409) {
         errorMsg = t.conflict;
      }
      setErrorMessage(errorMsg);
      setStatus('error');
    }
  };

  const handleSelectVersion = (content: string, sha: string) => {
    const isSpecialFile = config.filePath === '.vimrc';
    let newText = content;
    
    if (!isSpecialFile) {
      const lines = content.split('\n');
      const decryptedLines = lines.map(line => {
        if (!line.trim()) return '';
        try {
          return decryptLine(line, config.encryptionKey);
        } catch (e) {
          console.error('Failed to decrypt line', line, e);
          return '[[ Decryption Failed ]]';
        }
      });
      newText = decryptedLines.join('\n');
    }

    setText(newText);
    if (config.filePath) {
      localStorage.setItem('file:' + config.filePath, newText);
    }
    setErrorMessage(t.revertedVersion);
    setStatus('error'); // Show as a warning message
    setTimeout(() => setStatus('idle'), 4000);
  };

  const handleEmojiClick = (emojiData: any) => {
    const newText = text + emojiData.emoji;
    setText(newText);
    if (config.filePath) {
      localStorage.setItem('file:' + config.filePath, newText);
    }
    setShowEmojiPicker(false);
  };

  const handleSelectFile = (newFilePath: string) => {
    updateConfig({ filePath: newFilePath });
  };

  const isGithubConfigured = !!(config.githubToken && config.repoUrl);

  const lastVimrcRef = useRef(config.vimKeyBindings || '');

  // Load .vimrc from github if configured
  useEffect(() => {
    if (config.githubToken && config.repoUrl) {
      const loadVimrc = async () => {
        try {
          const res = await fetchFileFromGithub({
            githubToken: config.githubToken,
            repoUrl: config.repoUrl,
            filePath: '.vimrc',
            branch: config.branch || 'main'
          });
          if (res && res.content && res.content !== config.vimKeyBindings) {
            lastVimrcRef.current = res.content;
            updateConfig({ vimKeyBindings: res.content });
          }
        } catch (e) {
          // File might not exist
        }
      };
      loadVimrc();
    }
  }, [config.githubToken, config.repoUrl, config.branch]);

  // Save .vimrc to github if it changes
  useEffect(() => {
    if (!config.githubToken || !config.repoUrl || !config.vimKeyBindings) return;
    if (config.vimKeyBindings === lastVimrcRef.current) return;
    
    const handler = setTimeout(async () => {
      try {
        const res = await fetchFileFromGithub({
            githubToken: config.githubToken,
            repoUrl: config.repoUrl,
            filePath: '.vimrc',
            branch: config.branch || 'main'
        });
        const currentSha = res ? res.sha : null;
        if (res && res.content === config.vimKeyBindings) {
            lastVimrcRef.current = config.vimKeyBindings;
            return;
        }
        await saveFileToGithub({
            githubToken: config.githubToken,
            repoUrl: config.repoUrl,
            filePath: '.vimrc',
            branch: config.branch || 'main'
        }, config.vimKeyBindings, currentSha, 'Update .vimrc');
        
        lastVimrcRef.current = config.vimKeyBindings;
      } catch (e) {
        console.error("Failed to auto-save .vimrc", e);
      }
    }, 2000);
    
    return () => clearTimeout(handler);
  }, [config.vimKeyBindings, config.githubToken, config.repoUrl, config.branch]);

  // We should reload file whenever config.filePath changes
  useEffect(() => {
    if (config.filePath) {
      const localContent = localStorage.getItem('file:' + config.filePath) || '';
      setText(localContent);
      setOriginalText('__LOADING__');
      handleLoad(false);
    }
  }, [config.githubToken, config.repoUrl, config.encryptionKey, config.filePath, config.branch]);

  const handleTextChange = (val: string) => {
    setText(val);
    if (config.filePath) {
      localStorage.setItem('file:' + config.filePath, val);
    }
  };

  const hasChanges = text !== originalText && originalText !== '__LOADING__';

  return (
    <div className="w-full h-full bg-zinc-50 dark:bg-[#0F1115] text-zinc-900 dark:text-[#E0E0E0] font-sans flex flex-col overflow-hidden selection:bg-indigo-200 dark:selection:bg-indigo-500/40">
      
      {/* Header */}
      <header className="h-14 flex items-center justify-between px-6 border-b border-zinc-200 dark:border-[#2D3139] bg-white dark:bg-[#16191E] shrink-0">
        <div className="flex items-center gap-2 sm:gap-4 overflow-hidden">
          <button 
            onClick={() => setIsExplorerOpen(!isExplorerOpen)}
            className="hidden sm:block p-1.5 -ml-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-zinc-800 rounded transition-colors"
            title={isExplorerOpen ? "Close Explorer" : "Open Explorer"}
          >
            {isExplorerOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeft className="w-5 h-5" />}
          </button>
          <div className="w-8 h-8 rounded bg-indigo-600 flex items-center justify-center shrink-0 hidden sm:flex">
            <span className="font-bold text-white">C</span>
          </div>
          <div className="truncate">
            <h1 className="text-base sm:text-xl font-semibold tracking-tight text-zinc-900 dark:text-[#E0E0E0] leading-tight truncate">
              {t.title}
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-6">
          
          {/* Status Indicator */}
          {status !== 'idle' && (
            <div className={`text-[10px] sm:text-xs font-mono flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 rounded-full border ${
              status === 'error' ? 'bg-red-500/10 text-red-500 dark:text-red-400 border-red-500/20' :
              status === 'success' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
              'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
            }`}>
              {status === 'loading' && <RefreshCw className="w-3 h-3 animate-spin" />}
              {status === 'saving' && <RefreshCw className="w-3 h-3 animate-spin" />}
              {status === 'success' && <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />}
              {status === 'error' && <AlertCircle className="w-3 h-3" />}
              <span>
                {status === 'loading' ? t.pulling : 
                 status === 'saving' ? t.pushing : 
                 status === 'success' ? t.synchronized : errorMessage.toUpperCase()}
              </span>
            </div>
          )}

          {isGithubConfigured && hasChanges && (
            <div className="flex bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-1 shadow-inner text-sm">
              <button
                onClick={() => handleLoad(true)}
                disabled={status === 'loading' || status === 'saving'}
                className="flex items-center gap-2 px-3 py-1.5 font-medium rounded text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                title={t.fetchWarning}
              >
                <CloudDownload className="w-4 h-4" />
                <span className="hidden sm:inline">{t.pull}</span>
              </button>
              <div className="w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />
              <button
                onClick={() => handleSave(false)}
                disabled={status === 'loading' || status === 'saving'}
                className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded border border-indigo-700 transition-colors disabled:opacity-50 font-medium"
                title={t.push}
              >
                <CloudUpload className="w-4 h-4" />
                <span className="hidden sm:inline">{t.push}</span>
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-2 text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:hover:text-gray-200 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-md transition-colors"
              title="Global Search"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="p-2 text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:hover:text-gray-200 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-md transition-colors"
              title={t.history}
            >
              <History className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsConfigOpen(true)}
              className="p-2 text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:hover:text-gray-200 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-md transition-colors hidden sm:block"
              title={t.settings}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Toolbar (Hidden on Mobile) */}
      {!isMobile && (
        <div className="h-12 border-b border-zinc-200 dark:border-[#2D3139] flex items-center justify-between px-4 sm:px-6 bg-white dark:bg-[#16191E] shrink-0">
          <div className="flex space-x-4 sm:space-x-6 text-sm sm:text-base h-full">
            <button 
              onClick={() => setViewMode('editor')}
              className={`flex items-center gap-2 h-full border-b-2 transition-colors ${viewMode === 'editor' ? 'border-indigo-500 font-medium text-indigo-600 dark:text-indigo-400' : 'border-transparent text-zinc-500 dark:text-gray-500 hover:text-zinc-700 dark:hover:text-gray-300'}`}
            >
              <Type className="w-4 h-4" />
              <span className={isMobile ? 'hidden' : 'inline'}>{t.editor}</span>
              {isMobile && <span>Edit</span>}
            </button>
            {(!isMobile) && (
              <button 
                onClick={() => setViewMode('split')}
                className={`flex items-center gap-2 h-full border-b-2 transition-colors ${viewMode === 'split' ? 'border-indigo-500 font-medium text-indigo-600 dark:text-indigo-400' : 'border-transparent text-zinc-500 dark:text-gray-500 hover:text-zinc-700 dark:hover:text-gray-300'}`}
              >
                <Columns className="w-4 h-4" />
                {t.split || 'Split'}
              </button>
            )}
            <button 
              onClick={() => setViewMode('wysiwyg')}
              className={`flex items-center gap-2 h-full border-b-2 transition-colors ${viewMode === 'wysiwyg' ? 'border-indigo-500 font-medium text-indigo-600 dark:text-indigo-400' : 'border-transparent text-zinc-500 dark:text-gray-500 hover:text-zinc-700 dark:hover:text-gray-300'}`}
            >
              <Sparkles className="w-4 h-4" />
              <span>{t.wysiwyg || 'WYSIWYG'}</span>
            </button>
            <button 
              onClick={() => setViewMode('preview')}
              className={`flex items-center gap-2 h-full border-b-2 transition-colors ${viewMode === 'preview' ? 'border-indigo-500 font-medium text-indigo-600 dark:text-indigo-400' : 'border-transparent text-zinc-500 dark:text-gray-500 hover:text-zinc-700 dark:hover:text-gray-300'}`}
            >
              <Eye className="w-4 h-4" />
              <span className={isMobile ? 'hidden' : 'inline'}>{t.preview}</span>
              {isMobile && <span>View</span>}
            </button>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-500 dark:text-gray-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors"
            >
              <Smile className="w-4 h-4" />
              Emoji
            </button>
            {showEmojiPicker && (
              <div className="absolute right-0 top-full mt-2 z-50 shadow-xl border border-zinc-200 dark:border-zinc-800 rounded-lg">
                 <EmojiPicker 
                   onEmojiClick={handleEmojiClick}
                   theme={config.theme === 'dark' || (config.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' as any : 'light' as any}
                 />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Layout Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* File Tree Sidebar */}
        <div className={`
          ${isMobile ? 'absolute inset-y-0 left-0 z-30 shadow-2xl transition-transform duration-300 ease-in-out' : 'relative'}
          ${isExplorerOpen ? 'translate-x-0' : '-translate-x-full absolute'}
          ${!isMobile && !isExplorerOpen ? 'hidden' : ''}
          h-full bg-inherit
        `}>
          <FileTree 
            config={config} 
            onSelectFile={(path) => {
              handleSelectFile(path);
              if (isMobile) setIsExplorerOpen(false);
            }} 
            activeFile={config.filePath} 
          />
        </div>

        {/* Explorer Overlay for Mobile */}
        {isMobile && isExplorerOpen && (
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm z-20"
            onClick={() => setIsExplorerOpen(false)}
          />
        )}

        {/* Main Editor */}
        <main className="flex-1 flex bg-white dark:bg-[#0A0C0E] overflow-hidden relative">
          {viewMode === 'wysiwyg' ? (
            <div className="flex-1 h-full overflow-hidden">
              <WYSIWYGEditor
                value={text}
                onChange={handleTextChange}
                theme={config.theme}
              />
            </div>
          ) : (
            <>
              {(viewMode === 'editor' || viewMode === 'split') && (
                <div className={`h-full overflow-hidden ${viewMode === 'split' ? 'flex-[0_0_50%] border-r border-zinc-200 dark:border-zinc-800' : 'flex-1'}`}>
                  <Editor
                    value={text}
                    onChange={handleTextChange}
                    className="w-full h-full text-lg [&_.cm-editor]:h-full [&_.cm-editor]:w-full [&_.cm-scroller]:font-mono [&_.cm-content]:p-4 sm:p-6"
                    editable={!((isGithubConfigured && !config.encryptionKey) || status === 'loading')}
                    vimMode={config.vimMode}
                    vimKeyBindings={config.vimKeyBindings}
                    themeType={config.theme}
                    onCursorLineChange={handleCursorLineChange}
                  />
                </div>
              )}

              {((viewMode === 'split' || viewMode === 'preview') && (!isMobile || viewMode === 'preview')) && (
                <div ref={previewContainerRef} className={`p-4 sm:p-6 overflow-y-auto ${viewMode === 'split' ? 'flex-[0_0_50%]' : 'flex-1 lg:px-20'}`}>
                  {config.filePath && (config.filePath.toLowerCase().endsWith('.md') || config.filePath.toLowerCase().endsWith('.mdx')) ? (
                <div className={`prose prose-zinc prose-lg dark:prose-invert ${viewMode === 'split' ? 'max-w-none' : 'max-w-[800px] mx-auto'} 
                    prose-headings:font-semibold prose-a:text-indigo-500 
                    prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:bg-zinc-100 dark:prose-code:bg-zinc-800/50 
                    prose-code:before:content-none prose-code:after:content-none
                    prose-pre:p-0 prose-pre:bg-transparent dark:prose-pre:bg-transparent prose-pre:border-none`}>
                  <Markdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      img({node, ...props}: any) {
                        return (
                          <ZoomableView>
                            <img {...props} className="max-w-full rounded-md shadow-sm" />
                          </ZoomableView>
                        );
                      },
                      code({node, inline, className, children, ...props}: any) {
                        const match = /language-(\w+)/.exec(className || '')
                        const lang = match ? match[1] : ''
                        if (!inline && lang === 'mermaid') {
                          return <MermaidBlock chart={String(children).replace(/\n$/, '')} />
                        }
                        if (!inline && (lang === 'plantuml' || lang === 'puml')) {
                          return <PlantUMLBlock code={String(children).replace(/\n$/, '')} />
                        }
                        return !inline && match ? (
                          <SyntaxHighlighter
                            style={config.theme === 'dark' || (config.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? vscDarkPlus as any : vs as any}
                            language={lang}
                            PreTag="div"
                            className="rounded-md border border-zinc-200 dark:border-zinc-800 !my-0 !bg-zinc-50 dark:!bg-[#111318]"
                            {...props}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        )
                      }
                    }}
                  >
                    {text || '*No content to preview*'}
                  </Markdown>
                </div>
              ) : (
                <div className={viewMode === 'preview' ? 'max-w-[1000px] mx-auto h-full' : 'h-full'}>
                  <pre className="font-mono text-base whitespace-pre-wrap break-words text-zinc-800 dark:text-zinc-200">
                    {text || 'No content'}
                  </pre>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </main>
      </div>

      {/* Footer Bar */}
      {!isMobile && (
        <footer className="h-8 bg-zinc-50 dark:bg-[#16191E] border-t border-zinc-200 dark:border-[#2D3139] px-4 flex items-center justify-between text-[10px] sm:text-xs text-zinc-500 dark:text-gray-500 font-mono shrink-0">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="flex items-center gap-1 sm:gap-1.5 uppercase shrink-0">
              <span className={`w-1.5 h-1.5 rounded-full ${fileSha ? 'bg-indigo-500' : 'bg-zinc-400 dark:bg-gray-500'}`}></span>
              <span className="hidden sm:inline">{t.storage}</span>
            </div>
            <div className="truncate max-w-[80px] sm:max-w-none">{config.encryptionKey ? t.aesActive : t.aesInactive}</div>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4 overflow-hidden">
            <span className="truncate">{t.lines} {text ? text.split('\n').length : 0}</span>
            <span className="hidden sm:inline">{t.chars} {text.length}</span>
            <span className="hidden md:inline">UTF-8</span>
            <span className="text-indigo-600 dark:text-indigo-400 hidden sm:inline">{t.encryptionStatus}</span>
          </div>
        </footer>
      )}

      {/* Bottom Navigation (Mobile Only) */}
      {isMobile && (
        <nav className="box-content h-14 border-t border-zinc-200 dark:border-[#2D3139] bg-white dark:bg-[#16191E] shrink-0 flex justify-around items-center px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_10px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_10px_rgba(0,0,0,0.2)] z-10">
          <button 
            onClick={() => { setIsExplorerOpen(!isExplorerOpen); setIsConfigOpen(false); setIsHistoryOpen(false); setIsSearchOpen(false); }} 
            className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${isExplorerOpen ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
          >
            <PanelLeft className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium">Files</span>
          </button>
          <button 
            onClick={() => { setViewMode('editor'); setIsExplorerOpen(false); setIsConfigOpen(false); setIsHistoryOpen(false); setIsSearchOpen(false); }}
            className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${viewMode === 'editor' && !isExplorerOpen && !isConfigOpen ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
          >
            <Type className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium">{t.editor}</span>
          </button>
          <button 
            onClick={() => { setViewMode('wysiwyg'); setIsExplorerOpen(false); setIsConfigOpen(false); setIsHistoryOpen(false); setIsSearchOpen(false); }}
            className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${viewMode === 'wysiwyg' && !isExplorerOpen && !isConfigOpen ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
          >
            <Sparkles className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium">{t.wysiwyg || 'WYSIWYG'}</span>
          </button>
          <button 
            onClick={() => { setViewMode('preview'); setIsExplorerOpen(false); setIsConfigOpen(false); setIsHistoryOpen(false); setIsSearchOpen(false); }}
            className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${viewMode === 'preview' && !isExplorerOpen && !isConfigOpen ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
          >
            <Eye className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium">{t.preview}</span>
          </button>
          <button 
            onClick={() => { setIsConfigOpen(true); setIsExplorerOpen(false); setIsHistoryOpen(false); setIsSearchOpen(false); }}
            className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${isConfigOpen ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
          >
            <Settings className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium">{t.settings}</span>
          </button>
        </nav>
      )}

      {/* Overlays */}
      {(isConfigOpen || isHistoryOpen || isSearchOpen) && (
        <div 
          className="absolute inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-sm z-40"
          onClick={() => { setIsConfigOpen(false); setIsHistoryOpen(false); setIsSearchOpen(false); }}
        />
      )}
      
      {isSearchOpen && (
        <SearchPanel 
          config={config} 
          onClose={() => setIsSearchOpen(false)} 
          onSelectFile={(path) => {
             updateConfig({ filePath: path });
             setIsSearchOpen(false);
          }}
        />
      )}

      <ConfigPanel
        config={config}
        updateConfig={updateConfig}
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
      />

      <HistoryPanel
        config={config}
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onSelectVersion={handleSelectVersion}
        currentSha={fileSha}
      />
    </div>
  );
}
