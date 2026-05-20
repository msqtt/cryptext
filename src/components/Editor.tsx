import React, { useMemo, useEffect } from 'react';
import CodeMirror, { ReactCodeMirrorProps } from '@uiw/react-codemirror';
import { vim, Vim } from '@replit/codemirror-vim';
import { autocompletion, CompletionContext, startCompletion } from '@codemirror/autocomplete';
import { EditorView } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';
import { githubLight } from '@uiw/codemirror-theme-github';
import * as emojiModule from 'node-emoji';
const emoji = (emojiModule as any).default || emojiModule;
import { markdown } from '@codemirror/lang-markdown';

export interface EditorProps extends ReactCodeMirrorProps {
  vimMode?: boolean;
  vimKeyBindings?: string;
  themeType?: 'light' | 'dark' | 'system';
}

function emojiCompletion(context: CompletionContext) {
  const word = context.matchBefore(/:[a-zA-Z0-9_]*/);
  console.log("emojiCompletion invoked! word:", word, "explicit:", context.explicit);
  if (!word) return null;
  // trigger on typing `:` by removing the explicit check if text starts with `:`
  if (word.from === word.to && !context.explicit) {
    // If the character immediately before cursor is ':', trigger!
    const before = context.matchBefore(/:/);
    if (!before) return null;
  }

  const query = word.text.slice(1);
  const results = emoji.search(query).slice(0, 50);
  
  return {
    from: word.from,
    options: results.map(r => ({
      label: ':' + r.name,
      detail: r.emoji,
      apply: r.emoji,
      type: 'text'
    })),
    // Always requery when the user types to ensure we fetch fresh emoji matches
    validFor: (text, from, to, state) => false,
  };
}

const emojiExtension = autocompletion({ override: [emojiCompletion] });

const triggerOnColonExtension = EditorView.updateListener.of((update) => {
  if (update.docChanged) {
    const head = update.state.selection.main.head;
    if (head > 0) {
      const charBefore = update.state.sliceDoc(head - 1, head);
      if (charBefore === ':') {
        const charTwoBefore = head > 1 ? update.state.sliceDoc(head - 2, head - 1) : ' ';
        // Only trigger if preceded by whitespace or at start of line
        if (/\s/.test(charTwoBefore)) {
          startCompletion(update.view);
        }
      }
    }
  }
});

export const Editor: React.FC<EditorProps> = ({ vimMode, vimKeyBindings, themeType, ...props }) => {
  useEffect(() => {
    if (vimMode && vimKeyBindings) {
      // Minimal parser for vim bindings
      const lines = vimKeyBindings.split('\n');
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3 && !line.trim().startsWith('"') && !line.trim().startsWith('#')) {
          const mode = parts[0];
          const lhs = parts[1];
          const rhs = parts[2];
          const isNoremap = mode.includes('noremap');
          const method = isNoremap ? Vim.noremap : Vim.map;
          const context = (mode === 'map' || mode === 'noremap') ? undefined : 
            mode.startsWith('n') ? 'normal' 
            : mode.startsWith('i') ? 'insert' 
            : (mode.startsWith('v') || mode.startsWith('x')) ? 'visual' 
            : mode.startsWith('o') ? 'operator' // Some CodeMirror versions support this, if not, it will be ignored or throw, we catch it
            : 'normal'; // fall back to normal
            
          try {
            if (context) {
              (method as any)(lhs, rhs, context);
            } else {
              (method as any)(lhs, rhs);
            }
          } catch (e) {
            console.error('Failed to map vim key', line, e);
          }
        }
      });
    }
  }, [vimMode, vimKeyBindings]);

  const extensions = useMemo(() => {
    const exts = [markdown(), emojiExtension, triggerOnColonExtension];
    if (vimMode) {
      exts.push(vim());
    }
    return exts;
  }, [vimMode]);

  const resolvedTheme = useMemo(() => {
    let t = themeType || 'light';
    if (t === 'system') {
      t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return t === 'dark' ? oneDark : githubLight;
  }, [themeType]);

  return (
    <CodeMirror
      {...props}
      theme={resolvedTheme}
      extensions={extensions}
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: false,
      }}
    />
  );
};
