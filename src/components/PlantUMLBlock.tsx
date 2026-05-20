import React, { useMemo } from 'react';
import plantumlEncoder from 'plantuml-encoder';
import { ZoomableView } from './ZoomableView';

export const PlantUMLBlock: React.FC<{ code: string }> = ({ code }) => {
  const url = useMemo(() => {
    try {
      const encoded = plantumlEncoder.encode(code);
      return `https://www.plantuml.com/plantuml/svg/${encoded}`;
    } catch (e) {
      console.error('PlantUML encoding error', e);
      return '';
    }
  }, [code]);

  if (!url) {
    return <div className="p-4 bg-red-50 text-red-600 font-mono text-sm">Failed to generate PlantUML</div>;
  }

  return (
    <div className="flex justify-center my-6 bg-white p-4 rounded-lg">
      <ZoomableView>
        <img src={url} alt="PlantUML diagram" className="max-w-full" />
      </ZoomableView>
    </div>
  );
};
