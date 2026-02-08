export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-slate-200 rounded"></div>
          <div className="h-4 w-64 bg-slate-100 rounded"></div>
        </div>
        <div className="h-8 w-24 bg-slate-100 rounded-full"></div>
      </div>

      <div className="card overflow-hidden">
        <div className="h-10 bg-slate-50 border-b"></div>
        <div className="p-4 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="h-12 w-12 bg-slate-100 rounded"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/4 bg-slate-100 rounded"></div>
                <div className="h-4 w-full bg-slate-50 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
