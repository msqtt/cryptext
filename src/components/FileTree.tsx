import React, { useEffect, useState } from 'react';
import { AppConfig } from '../hooks/useConfig';
import { getRepoTree, renamePathInGithub, deletePathFromGithub } from '../lib/github';
import { FolderOpen, FileText, ChevronRight, ChevronDown, Plus, RefreshCw, File, Edit2, Trash2, Check, X } from 'lucide-react';

interface FileTreeProps {
  config: AppConfig;
  onSelectFile: (filePath: string) => void;
  activeFile: string;
}

const getLocalFiles = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem('cryptext_local_files') || '[]');
  } catch {
    return [];
  }
};

const addLocalFile = (path: string) => {
  const files = new Set(getLocalFiles());
  files.add(path);
  localStorage.setItem('cryptext_local_files', JSON.stringify(Array.from(files)));
};

const removeLocalFile = (path: string) => {
  const files = new Set(getLocalFiles());
  files.delete(path);
  // Also remove starting with path/ if folder
  for (const f of files) {
    if (f.startsWith(path + '/')) files.delete(f);
  }
  localStorage.setItem('cryptext_local_files', JSON.stringify(Array.from(files)));
};

export function FileTree({ config, onSelectFile, activeFile }: FileTreeProps) {
  const [tree, setTree] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [newFileType, setNewFileType] = useState<'file' | 'folder'>('file');
  const [newFilePath, setNewFilePath] = useState('');

  // Rename state
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  const loadTree = async () => {
    setLoading(true);
    setError('');
    
    let items: any[] = [];
    if (config.githubToken && config.repoUrl) {
      try {
        items = await getRepoTree(config);
      } catch (e: any) {
        if (e.status !== 404 && e.status !== 409) {
          setError(e.message || 'Error loading tree');
        }
      }
    }
    
    const localFiles = getLocalFiles().map(f => ({ path: f, type: 'blob' }));
    
    const map = new Map<string, any>();
    localFiles.forEach(i => map.set(i.path, i));
    items.forEach(i => map.set(i.path, i));
    
    setTree(Array.from(map.values()));
    
    if (activeFile) {
      const parts = activeFile.split('/');
      let current = '';
      const newExpanded = new Set(expandedFolders);
      for (let i = 0; i < parts.length - 1; i++) {
        current += (current ? '/' : '') + parts[i];
        newExpanded.add(current);
      }
      setExpandedFolders(newExpanded);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTree();
  }, [config.githubToken, config.repoUrl, config.branch, config.encryptionKey]);

  const toggleFolder = (path: string) => {
    const next = new Set(expandedFolders);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    setExpandedFolders(next);
  };

  const handleCreateFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFilePath) return;
    let path = newFilePath;
    if (newFileType === 'file' && !path.includes('.')) {
      path += '.txt';
    }
    if (newFileType === 'folder') {
      if (!path.endsWith('/')) {
        path += '/';
      }
      path += '.keep'; // Create a dummy file to keep the folder
    }
    addLocalFile(path);
    if (newFileType === 'file') {
      onSelectFile(path);
    }
    setShowNewFileInput(false);
    setNewFilePath('');
    loadTree();
  };

  const handleDelete = async (path: string, isDirectory: boolean) => {
    if (!confirm(`Are you sure you want to delete ${isDirectory ? 'folder' : 'file'}: ${path}?`)) return;
    
    const isLocalOnly = !tree.some(n => (n.path === path || n.path.startsWith(path + '/')) && !getLocalFiles().includes(n.path));
    
    removeLocalFile(path);
    localStorage.removeItem('file:' + path);
    
    if (!isLocalOnly && config.githubToken && config.repoUrl) {
      setLoading(true);
      try {
        await deletePathFromGithub(config, path, isDirectory);
        if (activeFile === path || activeFile.startsWith(path + '/')) {
          onSelectFile(''); // clear active file
        }
      } catch (e: any) {
        setError('Failed to delete: ' + e.message);
      }
      loadTree();
    } else {
       if (activeFile === path || activeFile.startsWith(path + '/')) {
          onSelectFile(''); // clear active file
       }
       loadTree();
    }
  };

  const startRename = (path: string) => {
    setRenamingPath(path);
    const parts = path.split('/');
    setRenameValue(parts[parts.length - 1]);
  };

  const submitRename = async (path: string, isDirectory: boolean) => {
    if (!renameValue || renameValue.trim() === '') {
      setRenamingPath(null);
      return;
    }
    const parts = path.split('/');
    parts.pop();
    const newPath = (parts.length > 0 ? parts.join('/') + '/' : '') + renameValue;
    
    if (newPath === path) {
      setRenamingPath(null);
      return;
    }

    setIsRenaming(true);
    try {
      const isLocalOnly = !tree.some(n => (n.path === path || n.path.startsWith(path + '/')) && !getLocalFiles().includes(n.path));
      
      if (!isLocalOnly && config.githubToken && config.repoUrl) {
        await renamePathInGithub(config, path, newPath, isDirectory);
      }
      
      // update local storage
      removeLocalFile(path);
      const content = localStorage.getItem('file:' + path);
      if (content !== null) {
        localStorage.removeItem('file:' + path);
        localStorage.setItem('file:' + newPath, content);
      }
      addLocalFile(newPath);
      
      if (activeFile === path || activeFile.startsWith(path + '/')) {
         onSelectFile(newPath); 
      }
      await loadTree();
    } catch(e: any) {
      setError('Failed to rename: ' + e.message);
    }
    setIsRenaming(false);
    setRenamingPath(null);
  };

  // Build a nested structure
  const buildNestedTree = (flatTree: any[]) => {
    const root: any = { children: {} };
    for (const item of flatTree) {
      const parts = item.path.split('/');
      let current = root;
      let currentPath = '';
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        currentPath += (currentPath === '' ? '' : '/') + part;
        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            path: currentPath,
            type: i === parts.length - 1 ? item.type : 'tree', // if it's the last part, use its type
            children: {}
          };
        }
        current = current.children[part];
      }
    }
    return root.children;
  };

  const renderTree = (nodes: any, depth: number = 0) => {
    const sortedNodes = Object.values(nodes).sort((a: any, b: any) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'tree' ? -1 : 1;
    });

    return sortedNodes.map((node: any) => {
      const isExpanded = expandedFolders.has(node.path);
      const isActive = activeFile === node.path;
      const isRenamingThis = renamingPath === node.path;
      
      if (node.type === 'tree') {
        return (
          <div key={node.path}>
            <div className={`w-full flex items-center justify-between py-1.5 px-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors text-base group`} style={{ paddingLeft: `${depth * 14 + 8}px` }}>
              <button
                onClick={() => toggleFolder(node.path)}
                className="flex items-center gap-2 flex-1 truncate text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-200"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <FolderOpen className="w-4 h-4 text-indigo-400" />
                
                {isRenamingThis ? (
                  <input 
                    type="text" 
                    value={renameValue} 
                    onChange={e => setRenameValue(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    onKeyDown={e => {
                      if (e.key === 'Enter') submitRename(node.path, true);
                      if (e.key === 'Escape') setRenamingPath(null);
                    }}
                    disabled={isRenaming}
                    className="flex-1 bg-white dark:bg-zinc-900 border border-indigo-500 rounded px-1 -ml-1 text-sm font-normal"
                    autoFocus
                  />
                ) : (
                  <span className="truncate w-full text-left">{node.name}</span>
                )}
              </button>

              {!isRenamingThis && (
                <div className="hidden group-hover:flex items-center space-x-1 pl-1">
                  <button onClick={() => startRename(node.path)} className="text-zinc-400 hover:text-indigo-500"><Edit2 className="w-3 h-3" /></button>
                  <button onClick={() => handleDelete(node.path, true)} className="text-zinc-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                </div>
              )}
              {isRenamingThis && (
                <div className="flex items-center space-x-1 pl-1">
                  <button onClick={() => submitRename(node.path, true)} className="text-green-500" disabled={isRenaming}><Check className="w-3 h-3" /></button>
                  <button onClick={() => setRenamingPath(null)} className="text-red-500" disabled={isRenaming}><X className="w-3 h-3" /></button>
                </div>
              )}
            </div>
            {isExpanded && renderTree(node.children, depth + 1)}
          </div>
        );
      }

      if (node.type !== 'tree' && node.name === '.keep') return null;

      return (
        <div 
          key={node.path}
          className={`w-full flex items-center justify-between py-1.5 px-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors text-base group ${isActive ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 font-medium' : 'text-zinc-600 dark:text-zinc-400'}`}
          style={{ paddingLeft: `${depth * 14 + 28}px` }}
        >
          <button
            onClick={() => onSelectFile(node.path)}
            className={`flex items-center gap-2 flex-1 truncate text-left hover:text-zinc-900 dark:hover:text-zinc-200`}
            title={node.path}
          >
            <FileText className="w-4 h-4 shrink-0 opacity-70" />
            {isRenamingThis ? (
               <input 
                 type="text" 
                 value={renameValue} 
                 onChange={e => setRenameValue(e.target.value)}
                 onClick={e => e.stopPropagation()}
                 onKeyDown={e => {
                   if (e.key === 'Enter') submitRename(node.path, false);
                   if (e.key === 'Escape') setRenamingPath(null);
                 }}
                 disabled={isRenaming}
                 className="flex-1 bg-white dark:bg-zinc-900 border border-indigo-500 rounded px-1 -ml-1 text-xs"
                 autoFocus
               />
            ) : (
               <span className="truncate">{node.name}</span>
            )}
          </button>
          
          {!isRenamingThis && (
            <div className="hidden group-hover:flex items-center space-x-1 pl-1">
              <button onClick={() => startRename(node.path)} className="text-zinc-400 hover:text-indigo-500"><Edit2 className="w-3 h-3" /></button>
              <button onClick={() => handleDelete(node.path, false)} className="text-zinc-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
            </div>
          )}
          {isRenamingThis && (
            <div className="flex items-center space-x-1 pl-1">
              <button onClick={() => submitRename(node.path, false)} className="text-green-500" disabled={isRenaming}><Check className="w-3 h-3" /></button>
              <button onClick={() => setRenamingPath(null)} className="text-red-500" disabled={isRenaming}><X className="w-3 h-3" /></button>
            </div>
          )}
        </div>
      );
    });
  };

  const nested = buildNestedTree(tree);

  return (
    <div className="w-72 border-r border-zinc-200 dark:border-[#2D3139] bg-zinc-50 dark:bg-[#16191E] flex flex-col h-full shrink-0">
      <div className="h-12 border-b border-zinc-200 dark:border-[#2D3139] flex items-center justify-between px-3 shrink-0">
        <span className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-gray-500">Explorer</span>
        <div className="flex flex-wrap items-center gap-1 justify-end max-w-full overflow-hidden">
          <button 
            onClick={() => {
              setNewFileType('file');
              setShowNewFileInput(true);
            }}
            className="p-1 rounded text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-zinc-800 transition-colors shrink-0"
            title="New File"
          >
            <File className="w-4 h-4" />
          </button>
          <button 
            onClick={() => {
              setNewFileType('folder');
              setShowNewFileInput(true);
            }}
            className="p-1 rounded text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-zinc-800 transition-colors shrink-0"
            title="New Folder"
          >
            <FolderOpen className="w-4 h-4" />
          </button>
          <button 
            onClick={loadTree}
            className="p-1 rounded text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-zinc-800 transition-colors shrink-0"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading && !isRenaming ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {showNewFileInput && (
          <form onSubmit={handleCreateFile} className="mb-2 px-1">
            <input
              type="text"
              autoFocus
              value={newFilePath}
              onChange={e => setNewFilePath(e.target.value)}
              placeholder={newFileType === 'folder' ? 'e.g. docs/new_folder' : 'e.g. docs/new.txt'}
              className="w-full bg-white dark:bg-zinc-900 border border-indigo-300 dark:border-indigo-500/50 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500 text-zinc-900 dark:text-zinc-100"
              onBlur={() => {
                if(!newFilePath) setShowNewFileInput(false);
              }}
            />
          </form>
        )}
        
        {error && (
          <div className="text-xs text-red-500 p-2 break-words">{error}</div>
        )}

        <div className="space-y-0.5">
          {renderTree(nested)}
        </div>
        
        {tree.length === 0 && !loading && !error && (
          <div className="text-xs text-zinc-500 dark:text-gray-500 p-2 text-center">
            No files found.<br/>Check config & refresh.
          </div>
        )}
      </div>
    </div>
  );
}
