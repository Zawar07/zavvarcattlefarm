interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export default function ConfirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel, danger = false }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-gray-400 text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl bg-gray-800 text-white font-medium min-h-[44px]">{cancelLabel}</button>
          <button onClick={onConfirm} className={`flex-1 py-3 rounded-xl font-medium min-h-[44px] ${danger ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-primary-600 hover:bg-primary-700 text-white'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
