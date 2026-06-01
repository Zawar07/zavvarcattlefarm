interface Props {
  message: string;
  onDismiss?: () => void;
}

export default function ErrorBanner({ message, onDismiss }: Props) {
  return (
    <div className="bg-red-900/50 border border-red-700 rounded-xl p-3 flex items-start gap-3">
      <span className="text-red-400 text-lg">⚠</span>
      <p className="text-red-300 text-sm flex-1">{message}</p>
      {onDismiss && (
        <button onClick={onDismiss} className="text-red-400 hover:text-red-200 text-lg leading-none min-w-[44px] min-h-[44px] flex items-center justify-center">×</button>
      )}
    </div>
  );
}
