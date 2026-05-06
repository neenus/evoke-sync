interface Props {
  step: number;
  total: number;
  labels: string[];
}

export function ProgressBar({ step, total, labels }: Props) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        {labels.map((label, i) => (
          <div key={i} className="flex flex-col items-center flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${
                i < step
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : i === step
                    ? 'bg-white border-blue-600 text-blue-600'
                    : 'bg-white border-gray-300 text-gray-400'
              }`}
            >
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`mt-1 text-xs ${i <= step ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
              {label}
            </span>
          </div>
        ))}
      </div>
      <div className="relative h-1 bg-gray-200 rounded">
        <div
          className="absolute h-1 bg-blue-600 rounded transition-all"
          style={{ width: `${(step / (total - 1)) * 100}%` }}
        />
      </div>
    </div>
  );
}
