interface Props {
  title?: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h2 className="text-base font-semibold text-gray-900">{title}</h2>}
        <p className="text-sm text-gray-600">{message}</p>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg text-white ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
