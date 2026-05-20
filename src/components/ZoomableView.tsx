import React, { useState } from 'react';
import { Maximize2, X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

export const ZoomableView: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);

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
            wheel={{ step: 0.1 }}
          >
            {({ zoomIn, zoomOut, resetTransform }) => (
              <>
                <div className="absolute top-4 right-4 flex items-center gap-2 z-[110]">
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
                    {children}
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
