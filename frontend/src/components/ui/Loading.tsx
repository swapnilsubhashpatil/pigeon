/** @format */

export function Loading({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="relative w-8 h-8">
          <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-500 animate-spin" />
        </div>
        <span className="text-xs text-gray-600 font-medium">{text}</span>
      </div>
    </div>
  );
}
