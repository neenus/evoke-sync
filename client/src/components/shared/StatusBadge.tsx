import { statusLabel } from '../../utils/formatters';

interface Props {
  status: string;
}

const CONFIG: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-600' },
  in_progress: { bg: 'bg-blue-100', text: 'text-blue-700' },
  pending_approval: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  approved: { bg: 'bg-green-100', text: 'text-green-700' },
};

export function StatusBadge({ status }: Props) {
  const { bg, text } = CONFIG[status] ?? CONFIG.draft;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
      {statusLabel(status)}
    </span>
  );
}
