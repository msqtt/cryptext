import React, { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MermaidBlock } from './MermaidBlock';
import { PlantUMLBlock } from './PlantUMLBlock';
import { ZoomableView } from './ZoomableView';
import { Trash2, Plus, ArrowUp, ArrowDown, Check, X, Edit3, GripVertical } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { githubLight } from '@uiw/codemirror-theme-github';

interface WYSIWYGEditorProps {
  value: string;
  onChange: (val: string) => void;
  theme: 'light' | 'dark' | 'system';
}

export const WYSIWYGEditor: React.FC<WYSIWYGEditorProps> = ({ value, onChange, theme }) => {
  const [blocks, setBlocks] = useState<string[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftText, setDraftText] = useState<string>('');
  const activeEditorRef = useRef<any>(null);

  useEffect(() => {
    if (editingIndex === null) {
      const parsed = value.split(/\n\s*\n/).filter(b => b.trim() !== '');
      setBlocks(parsed.length > 0 ? parsed : ['# Start editing...\n\nClick any block to edit this document in real-time.']);
    }
  }, [value, editingIndex]);

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setDraftText(blocks[index]);
  };

  const handleSaveEdit = (index: number) => {
    const updated = [...blocks];
    updated[index] = draftText;
    const finalDocument = updated.join('\n\n');
    onChange(finalDocument);
    setBlocks(updated);
    setEditingIndex(null);
  };

  const handleAddBlock = (index: number) => {
    const updated = [...blocks];
    updated.splice(index + 1, 0, 'New paragraph... Click "Edit" to customize.');
    const finalDocument = updated.join('\n\n');
    onChange(finalDocument);
    setBlocks(updated);
    setEditingIndex(index + 1);
    setDraftText('New paragraph... Click "Edit" to customize.');
  };

  const handleDeleteBlock = (index: number) => {
    const updated = blocks.filter((_, i) => i !== index);
    const finalDocument = updated.join('\n\n');
    onChange(finalDocument);
    setBlocks(updated.length > 0 ? updated : ['# New Document']);
    setEditingIndex(null);
  };

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === blocks.length - 1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...blocks];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    const finalDocument = updated.join('\n\n');
    onChange(finalDocument);
    setBlocks(updated);
  };

  const resolvedTheme = () => {
    let t = theme || 'light';
    if (t === 'system') {
      t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return t === 'dark' ? oneDark : githubLight;
  };

  return (
    <div className="w-full h-full overflow-y-auto px-4 py-8 sm:px-10 md:px-20 bg-white dark:bg-[#0A0C0E]">
      <div className="max-w-[800px] mx-auto space-y-4">
        
        {blocks.map((blockContent, index) => {
          const isEditing = editingIndex === index;
          
          return (
            <div 
              key={index}
              className={`group relative border rounded-xl transition-all duration-200 ${
                isEditing 
                  ? 'border-indigo-500 ring-2 ring-indigo-500/15 bg-zinc-50/50 dark:bg-zinc-900/20 p-4' 
                  : 'border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 hover:bg-zinc-50/30 dark:hover:bg-zinc-900/10 p-4'
              }`}
            >
              {/* Overlay controls for hover style */}
              {!isEditing && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex items-center gap-1 bg-white dark:bg-[#16191E] border border-zinc-200 dark:border-[#2D3139] p-1 rounded-lg shadow-md z-10 transition-all">
                  <button
                    onClick={() => handleStartEdit(index)}
                    className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded transition"
                    title="Edit block"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleMoveBlock(index, 'up')}
                    disabled={index === 0}
                    className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-gray-400 rounded transition disabled:opacity-30"
                    title="Move up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleMoveBlock(index, 'down')}
                    disabled={index === blocks.length - 1}
                    className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-gray-400 rounded transition disabled:opacity-30"
                    title="Move down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteBlock(index)}
                    className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500 dark:text-red-400 rounded transition"
                    title="Delete block"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {isEditing ? (
                <div className="space-y-3">
                  <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-[#2D3139]">
                    <CodeMirror
                      value={draftText}
                      onChange={(val) => setDraftText(val)}
                      theme={resolvedTheme()}
                      extensions={[markdown()]}
                      autoFocus
                      className="text-base font-mono"
                      basicSetup={{
                        lineNumbers: false,
                        foldGutter: false,
                        highlightActiveLine: false,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-zinc-400 font-mono">
                      Shift + Enter to Save
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveEdit(index)}
                        className="py-1 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold flex items-center gap-1 shadow transition"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Save
                      </button>
                      <button
                        onClick={() => setEditingIndex(null)}
                        className="py-1 px-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-gray-300 rounded-md text-xs font-medium flex items-center gap-1 transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div 
                  className="prose prose-zinc prose-lg dark:prose-invert max-w-none cursor-pointer prose-headings:font-semibold prose-a:text-indigo-500 hover:opacity-95"
                  onClick={() => handleStartEdit(index)}
                >
                  <Markdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      img({node, ...props}: any) {
                        return (
                          <ZoomableView>
                            <img {...props} className="max-w-full rounded-md shadow-sm mx-auto" />
                          </ZoomableView>
                        );
                      },
                      code({node, inline, className, children, ...props}: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        const lang = match ? match[1] : '';
                        if (!inline && lang === 'mermaid') {
                          return <MermaidBlock chart={String(children).replace(/\n$/, '')} />;
                        }
                        if (!inline && (lang === 'plantuml' || lang === 'puml')) {
                          return <PlantUMLBlock code={String(children).replace(/\n$/, '')} />;
                        }
                        return <code className={className} {...props}>{children}</code>;
                      }
                    }}
                  >
                    {blockContent}
                  </Markdown>
                </div>
              )}

              {/* Float divider insert line */}
              {!isEditing && (
                <div className="absolute bottom-[-10px] left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-200 z-10 w-full">
                  <button
                    onClick={() => handleAddBlock(index)}
                    className="flex items-center gap-1 px-3 py-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full text-[10px] font-bold shadow-md hover:scale-105 active:scale-95 transition-all"
                  >
                    <Plus className="w-3 h-3" />
                    Insert Block
                  </button>
                </div>
              )}
            </div>
          );
        })}

        <div className="pt-6 text-center">
          <button
            onClick={() => handleAddBlock(blocks.length - 1)}
            className="px-4 py-2 border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-indigo-500 text-zinc-400 hover:text-indigo-500 rounded-xl text-sm font-medium flex items-center gap-1.5 mx-auto transition-all"
          >
            <Plus className="w-4 h-4" />
            Append New Block
          </button>
        </div>

      </div>
    </div>
  );
};
