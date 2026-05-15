import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

export const MermaidBlock: React.FC<{ chart: string }> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgStr, setSvgStr] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default',
    });

    const renderChart = async () => {
      try {
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, chart);
        setSvgStr(svg);
        setError('');
      } catch (err: any) {
        console.error('Mermaid rendering error:', err);
        setError(err.message || 'Error rendering Mermaid chart');
      }
    };

    if (chart) {
      renderChart();
    }
  }, [chart]);

  if (error) {
    return <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-mono text-sm rounded border border-red-200 dark:border-red-800 break-words whitespace-pre-wrap">{error}</div>;
  }

  if (svgStr) {
    return <div className="flex justify-center my-6" dangerouslySetInnerHTML={{ __html: svgStr }} />;
  }

  return <div className="p-4 text-center text-zinc-500 animate-pulse">Rendering chart...</div>;
};
