import { InvoiceRow } from '../../types';
import { formatCAD, formatDelta, actionLabel } from '../../utils/formatters';

interface Props {
  invoices: InvoiceRow[];
}

export function SummaryPanel({ invoices }: Props) {
  const totalBilled = invoices.reduce((s, i) => s + i.amountBilled, 0);
  const totalActual = invoices.reduce((s, i) => s + i.actualAmount, 0);
  const totalDelta = totalActual - totalBilled;

  const counts = {
    awaiting_data: invoices.filter((i) => i.action === 'awaiting_data').length,
    additional_charge: invoices.filter((i) => i.action === 'additional_charge').length,
    credit_memo: invoices.filter((i) => i.action === 'credit_memo').length,
    no_change: invoices.filter((i) => i.action === 'no_change').length,
  };

  return (
    <div className="space-y-6">
      {/* Aggregate totals */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Billed', value: formatCAD(totalBilled), color: 'text-gray-900' },
          { label: 'Total Actual', value: formatCAD(totalActual), color: 'text-gray-900' },
          {
            label: 'Net Delta',
            value: formatDelta(Math.round(totalDelta * 100) / 100),
            color: totalDelta > 0 ? 'text-orange-600' : totalDelta < 0 ? 'text-red-600' : 'text-green-600',
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Action counts */}
      <div className="grid grid-cols-4 gap-3">
        {(Object.entries(counts) as [string, number][]).map(([action, count]) => (
          <div key={action} className="bg-white rounded-lg border border-gray-200 p-3 text-center">
            <p className="text-2xl font-bold text-gray-800">{count}</p>
            <p className="text-xs text-gray-500 mt-0.5">{actionLabel(action)}</p>
          </div>
        ))}
      </div>

      {/* Invoice table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
              <th className="px-3 py-2">Practitioner</th>
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Billed</th>
              <th className="px-3 py-2">Actual</th>
              <th className="px-3 py-2">Delta</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoices.map((inv) => (
              <tr key={inv.invoiceNo} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{inv.practitioner}</td>
                <td className="px-3 py-2">{inv.clientName}</td>
                <td className="px-3 py-2">{formatCAD(inv.amountBilled)}</td>
                <td className="px-3 py-2">{formatCAD(inv.actualAmount)}</td>
                <td className={`px-3 py-2 font-medium ${inv.delta > 0 ? 'text-orange-600' : inv.delta < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                  {formatDelta(inv.delta)}
                </td>
                <td className="px-3 py-2">{actionLabel(inv.action)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
