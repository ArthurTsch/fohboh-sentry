export function Toast({ message }: { message: string }) {
  return (
    <div className="fixed top-5 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-[var(--text)] px-4 py-2 text-sm text-white shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
      {message}
    </div>
  );
}
