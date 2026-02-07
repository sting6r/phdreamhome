"use client";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({ 
  title = "Failed to load data", 
  message = "There was a connection issue with the database. Please try refreshing the page.",
  onRetry 
}: ErrorStateProps) {
  return (
    <div className="p-8 text-center border-2 border-dashed rounded-lg bg-slate-50">
      <h2 className="text-xl font-semibold text-slate-900 mb-2">{title}</h2>
      <p className="text-slate-600 mb-4">{message}</p>
      <button 
        onClick={() => onRetry ? onRetry() : window.location.reload()}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm transition-colors"
      >
        Refresh Page
      </button>
    </div>
  );
}
