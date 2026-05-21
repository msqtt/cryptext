import React, { useEffect, useState } from 'react';
import { AppConfig } from '../hooks/useConfig';
import { getRepoTree } from '../lib/github';
import { FolderOpen, FileText, ChevronRight, ChevronDown, Plus, RefreshCw, File, Edit2, Trash2, Check, X } from 'lucide-react';

interface FileTreeProps {
  config: AppConfig;
  onSelectFile: (filePath: string, skipAutoSave?: boolean) => void;
  activeFile: string;
  onStageChange?: (changes: Record<string, any>) => void;
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

export function FileTree({ config, onSelectFile, activeFile, onStageChange }: FileTreeProps) {
  const [tree, setTree] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [newFileType, setNewFileType] = useState<'file' | 'folder'>('file');
  const [newFilePath, setNewFilePath] = useState('');

  // Drag and drop state
  const [draggedItem, setDraggedItem] = useState<{ path: string, isDirectory: boolean } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

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
    localStorage.setItem('file:' + path, '');
    onStageChange?.({ [path]: { type: 'write', content: '' } });
    if (newFileType === 'file') {
      onSelectFile(path);
    }
    setShowNewFileInput(false);
    setNewFilePath('');
    
    // Update local tree without fetching from github
    setTree(prev => {
      const map = new Map<string, any>();
      prev.forEach(i => map.set(i.path, i));
      map.set(path, { path, type: 'blob' });
      return Array.from(map.values());
    });
  };

  const handleDelete = async (path: string, isDirectory: boolean) => {
    if (!confirm(`Are you sure you want to delete ${isDirectory ? 'folder' : 'file'}: ${path}?`)) return;
    
    removeLocalFile(path);
    localStorage.removeItem('file:' + path);
    const changes: any = {};
    
    if (isDirectory) {
      const prefix = path + '/';
      const toDelete = tree.filter(n => n.type === 'blob' && (n.path.startsWith(prefix) || n.path === path));
      for (const f of toDelete) {
         changes[f.path] = { type: 'delete' };
         removeLocalFile(f.path);
         localStorage.removeItem('file:' + f.path);
      }
      setTree(prev => prev.filter(n => !(n.path === path || n.path.startsWith(prefix))));
    } else {
      changes[path] = { type: 'delete' };
      setTree(prev => prev.filter(n => n.path !== path));
    }
    
    onStageChange?.(changes);

    if (activeFile === path || activeFile.startsWith(path + '/')) {
      onSelectFile('', true); // clear active file, skip auto save
    }
  };

  const startRename = (path: string) => {
    setRenamingPath(path);
    const parts = path.split('/');
    setRenameValue(parts[parts.length - 1]);
  };

  const moveItem = async (sourcePath: string, newPath: string, isDirectory: boolean) => {
    if (sourcePath === newPath) return;
    setLoading(true);
    try {
      const changes: any = {};
      const localFiles = getLocalFiles();

      if (isDirectory) {
        const prefix = sourcePath + '/';
        const filesToMove = tree.filter(n => n.type === 'blob' && n.path.startsWith(prefix));
        for (const f of filesToMove) {
          const oldFilePath = f.path;
          const newFilePath = newPath + '/' + oldFilePath.substring(prefix.length);
          
          changes[oldFilePath] = { type: 'delete' };
          const localContent = localStorage.getItem('file:' + oldFilePath);
          if (localContent !== null) {
            changes[newFilePath] = { type: 'write', content: localContent };
            localStorage.setItem('file:' + newFilePath, localContent);
            localStorage.removeItem('file:' + oldFilePath);
            addLocalFile(newFilePath);
            removeLocalFile(oldFilePath);
          } else {
            changes[newFilePath] = { type: 'write', sha: f.sha };
          }
        }
      } else {
         changes[sourcePath] = { type: 'delete' };
         const oldNode = tree.find(n => n.path === sourcePath);
         const localContent = localStorage.getItem('file:' + sourcePath);
         if (localContent !== null) {
            changes[newPath] = { type: 'write', content: localContent };
            localStorage.setItem('file:' + newPath, localContent);
            localStorage.removeItem('file:' + sourcePath);
            addLocalFile(newPath);
            removeLocalFile(sourcePath);
         } else if (oldNode) {
            changes[newPath] = { type: 'write', sha: oldNode.sha };
         }
      }

      onStageChange?.(changes);
      
      setTree(prev => {
        const map = new Map<string, any>();
        prev.forEach(i => map.set(i.path, i));
        
        if (isDirectory) {
           const prefix = sourcePath + '/';
           const filesToMove = prev.filter(n => n.type === 'blob' && n.path.startsWith(prefix));
           for (const f of filesToMove) {
             map.delete(f.path);
             const newFilePath = newPath + '/' + f.path.substring(prefix.length);
             map.set(newFilePath, { ...f, path: newFilePath });
           }
        } else {
           map.delete(sourcePath);
           const oldNode = map.get(sourcePath) || { type: 'blob' };
           map.set(newPath, { ...oldNode, path: newPath });
        }
        return Array.from(map.values());
      });
      
      if (activeFile === sourcePath || activeFile.startsWith(sourcePath + '/')) {
         const newActiveFile = activeFile === sourcePath ? newPath : newPath + activeFile.slice(sourcePath.length);
         onSelectFile(newActiveFile, true); 
      }
    } catch(e: any) {
      setError('Failed to move: ' + e.message);
    }
    setLoading(false);
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
    await moveItem(path, newPath, isDirectory);
    setIsRenaming(false);
    setRenamingPath(null);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, path: string, isDirectory: boolean) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', path);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedItem({ path, isDirectory });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent, path: string, isDirectory: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDirectory) {
      setDropTarget(path);
    } else {
      const parts = path.split('/');
      parts.pop();
      setDropTarget(parts.length > 0 ? parts.join('/') : '');
    }
  };

  const handleRootDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget('');
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDropTarget(null);
  };

  const handleDrop = async (e: React.DragEvent, overrideTarget?: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const targetFolder = overrideTarget !== undefined ? overrideTarget : dropTarget;
    setDropTarget(null);

    if (!draggedItem) return;
    
    const { path: sourcePath, isDirectory } = draggedItem;
    const itemName = sourcePath.split('/').pop() || '';
    const newPath = targetFolder ? `${targetFolder}/${itemName}` : itemName;
    
    if (sourcePath === newPath || newPath.startsWith(sourcePath + '/')) {
      handleDragEnd();
      return;
    }
    
    handleDragEnd();
    await moveItem(sourcePath, newPath, isDirectory);
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
        const isDropTarget = dropTarget === node.path;
        return (
          <div key={node.path}>
            <div 
              draggable
              onDragStart={(e) => handleDragStart(e, node.path, true)}
              onDragOver={handleDragOver}
              onDragEnter={(e) => handleDragEnter(e, node.path, true)}
              onDrop={(e) => handleDrop(e, node.path)}
              onDragEnd={handleDragEnd}
              className={`w-full flex items-center justify-between py-1 px-2 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 rounded-md transition-colors text-sm group cursor-pointer ${isDropTarget ? 'ring-2 ring-indigo-500 bg-indigo-50 dark:bg-indigo-500/20' : ''}`} style={{ paddingLeft: `${depth * 12 + 8}px` }} onClick={() => toggleFolder(node.path)}>
              <div
                className="flex items-center gap-1.5 flex-1 truncate text-zinc-700 dark:text-zinc-300 font-medium"
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />}
                <FolderOpen className="w-4 h-4 text-indigo-500/80 dark:text-indigo-400 tracking-tight" />
                
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
              </div>

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

      const isDropTarget = dropTarget === (node.path.includes('/') ? node.path.split('/').slice(0, -1).join('/') : '');

      return (
        <div 
          key={node.path}
          draggable
          onDragStart={(e) => handleDragStart(e, node.path, false)}
          onDragOver={handleDragOver}
          onDragEnter={(e) => handleDragEnter(e, node.path, false)}
          onDrop={(e) => handleDrop(e, node.path.includes('/') ? node.path.split('/').slice(0, -1).join('/') : '')}
          onDragEnd={handleDragEnd}
          className={`w-full flex items-center justify-between py-1 px-2 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 rounded-md transition-colors text-sm group cursor-pointer ${isActive ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300 font-medium' : 'text-zinc-600 dark:text-zinc-400'} ${isDropTarget ? 'ring-inset border-indigo-500/50' : ''}`}
          style={{ paddingLeft: `${depth * 12 + 28}px` }}
          onClick={() => onSelectFile(node.path)}
        >
          <div
            className={`flex items-center gap-1.5 flex-1 truncate text-left hover:text-zinc-900 dark:hover:text-zinc-200`}
            title={node.path}
          >
            <FileText className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'opacity-100 text-indigo-500' : 'opacity-70'}`} />
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
          </div>
          
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
      
      <div 
        className={`flex-1 overflow-y-auto p-2 ${dropTarget === '' ? 'bg-indigo-50/50 dark:bg-indigo-500/5' : ''}`}
        onDragOver={handleDragOver}
        onDragEnter={handleRootDragEnter}
        onDrop={(e) => handleDrop(e, '')}
      >
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
