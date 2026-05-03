"use client";
import Image from "next/image";
import { useState } from "react";
import { X, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { getProxyImageUrl } from "@/lib/image-utils";

export default function BlogImage({ src, alt, path }: { src: string; alt: string; path?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [scale, setScale] = useState(1);

  const imageSrc = path ? getProxyImageUrl(path) : src;

  return (
    <>
      <div 
        className="relative w-full h-72 sm:h-96 rounded overflow-hidden bg-slate-200 my-4 cursor-zoom-in group"
        onClick={() => {
          setIsOpen(true);
          setScale(1);
        }}
      >
        <Image 
          src={imageSrc} 
          alt={alt} 
          fill 
          sizes="(max-width: 640px) 100vw, 60vw" 
          className="object-cover transition-transform duration-300 group-hover:scale-105" 
          unoptimized 
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 bg-white/90 p-2 rounded-full shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all">
            <Maximize2 size={20} className="text-slate-700" />
          </div>
        </div>
      </div>

      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4 sm:p-8"
          onClick={() => setIsOpen(false)}
        >
          <div 
            className="relative w-full h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => {
              const delta = e.deltaY < 0 ? 0.1 : -0.1;
              setScale(s => Math.min(3, Math.max(0.5, s + delta)));
            }}
          >
            <div 
              className="relative w-full h-full transition-transform duration-200 ease-out"
              style={{ transform: `scale(${scale})` }}
            >
              <Image 
                src={imageSrc} 
                alt={alt} 
                fill 
                className="object-contain" 
                unoptimized 
              />
            </div>
          </div>

          <div className="absolute top-4 right-4 flex gap-2">
            <button 
              onClick={() => setScale(s => Math.min(3, s + 0.25))}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
              title="Zoom In"
            >
              <ZoomIn size={20} />
            </button>
            <button 
              onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
              title="Zoom Out"
            >
              <ZoomOut size={20} />
            </button>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/60 text-xs font-medium bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-sm">
            Scroll or use buttons to zoom • Click outside to close
          </div>
        </div>
      )}
    </>
  );
}
