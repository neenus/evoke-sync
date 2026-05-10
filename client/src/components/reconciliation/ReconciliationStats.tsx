import { InvoiceRow } from '../../types';
import { formatCAD } from '../../utils/formatters';

interface Props {
  invoices: InvoiceRow[];
}

interface Stat {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}

export function ReconciliationStats({ invoices }: Props) {
  const active = invoices.filter((i) => !i.excluded);
  const excluded = invoices.filter((i) => i.excluded);
  const awaiting = active.filter((i) => i.action === 'awaiting_data');
  const noChange = active.filter((i) => i.action === 'no_change');
  const charges = active.filter((i) => i.action === 'additional_charge');
  const credits = active.filter((i) => i.action === 'credit_memo');
  const manual = invoices.filter((i) => i.isManual);

  const chargesTotal = charges.reduce((s, i) => s + i.delta, 0);
  const creditsTotal = credits.reduce((s, i) => s + i.delta, 0);
  const netDelta = active.reduce((s, i) => s + i.delta, 0);

  const stats: Stat[] = [
    {
      label: 'Total',
      value: invoices.length,
      sub: manual.length > 0 ? `${manual.length} manual` : undefined,
      color: 'text-gray-800',
    },
    {
      label: 'Excluded',
      value: excluded.length,
      color: excluded.length > 0 ? 'text-gray-500' : 'text-gray-400',
    },
    {
      label: 'Awaiting Data',
      value: awaiting.length,
      color: awaiting.length > 0 ? 'text-amber-600' : 'text-gray-400',
    },
    {
      label: 'No Change',
      value: noChange.length,
      color: noChange.length > 0 ? 'text-green-700' : 'text-gray-400',
    },
    {
      label: 'Charges',
      value: charges.length,
      sub: charges.length > 0 ? `+${formatCAD(chargesTotal)}` : undefined,
      color: charges.length > 0 ? 'text-orange-600' : 'text-gray-400',
    },
    {
      label: 'Credits',
      value: credits.length,
      sub: credits.length > 0 ? formatCAD(creditsTotal) : undefined,
      color: credits.length > 0 ? 'text-red-600' : 'text-gray-400',
    },
    {
      label: 'Net Delta',
      value: netDelta === 0 ? formatCAD(0) : (netDelta > 0 ? '+' : '') + formatCAD(netDelta),
      color: netDelta > 0 ? 'text-orange-600' : netDelta < 0 ? 'text-red-600' : 'text-gray-400',
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
      <div className="grid grid-cols-7 divide-x divide-gray-100">
        {stats.map((s) => (
          <div key={s.label} className="px-4 first:pl-0 last:pr-0 flex flex-col gap-0.5">
            <span className="text-[11px] text-gray-400 uppercase tracking-wide font-medium">{s.label}</span>
            <span className={`text-xl font-bold leading-tight ${s.color}`}>{s.value}</span>
            {s.sub && (
              <span className={`text-[11px] font-medium ${s.color} opacity-80`}>{s.sub}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
