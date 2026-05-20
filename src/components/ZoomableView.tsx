import React, { useState } from 'react';
import { Maximize2, X, ZoomIn, ZoomOut, RotateCcw, Paintbrush } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

export const ZoomableView: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [bgType, setBgType] = useState<'checkerboard' | 'white' | 'dark'>('checkerboard');

  const cycleBg = () => {
    if (bgType === 'checkerboard') setBgType('white');
    else if (bgType === 'white') setBgType('dark');
    else setBgType('checkerboard');
  };

  const currentStyle = bgType === 'checkerboard' ? {
    backgroundImage: 'conic-gradient(#f3f4f6 0.25turn, #ffffff 0.25turn 0.5turn, #f3f4f6 0.5turn 0.75turn, #ffffff 0.75turn)',
    backgroundSize: '16px 16px',
    backgroundColor: '#ffffff'
  } : bgType === 'white' ? {
    backgroundColor: '#ffffff',
    backgroundImage: 'none'
  } : {
    backgroundColor: '#18181b',
    backgroundImage: 'none'
  };

  return (
    <>
      <div 
        className="relative group inline-block cursor-zoom-in w-full text-center" 
        onClick={() => setIsOpen(true)}
      >
        {children}
        <div className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity">
          <Maximize2 className="w-4 h-4" />
        </div>
      </div>
      
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm">
          <TransformWrapper
            initialScale={1}
            minScale={0.1}
            maxScale={8}
            centerOnInit
            wheel={{ step: 0.015 }}
          >
            {({ zoomIn, zoomOut, resetTransform }) => (
              <>
                <div className="absolute top-4 right-4 flex items-center gap-2 z-[110]">
                  <button 
                    onClick={cycleBg} 
                    className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-1 text-xs font-medium"
                    title="Change background color"
                  >
                    <Paintbrush className="w-4 h-4" />
                    <span>
                      {bgType === 'checkerboard' ? 'Grid' : bgType === 'white' ? 'White' : 'Dark'}
                    </span>
                  </button>
                  <button onClick={() => zoomIn()} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors">
                    <ZoomIn className="w-5 h-5"/>
                  </button>
                  <button onClick={() => zoomOut()} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors">
                    <ZoomOut className="w-5 h-5"/>
                  </button>
                  <button onClick={() => resetTransform()} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg mr-4 transition-colors">
                    <RotateCcw className="w-5 h-5"/>
                  </button>
                  <button onClick={() => setIsOpen(false)} className="p-2 bg-white/10 hover:bg-red-500/80 text-white rounded-lg transition-colors">
                    <X className="w-6 h-6"/>
                  </button>
                </div>
                <div className="w-full h-full cursor-grab active:cursor-grabbing">
                  <TransformComponent
                    wrapperStyle={{ width: '100%', height: '100%' }}
                    contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <div 
                      className="p-6 rounded-xl shadow-2xl transition-colors duration-200 border border-zinc-200 dark:border-zinc-800"
                      style={currentStyle}
                    >
                      {children}
                    </div>
                  </TransformComponent>
                </div>
              </>
            )}
          </TransformWrapper>
        </div>
      )}
    </>
  );
};
