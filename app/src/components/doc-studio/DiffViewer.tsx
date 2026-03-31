interface DiffLine {
  type: 'unchanged' | 'added' | 'removed';
  content: string;
  lineA?: number;
  lineB?: number;
}

function computeDiff(a: string, b: string): DiffLine[] {
  const linesA = a.split('\n');
  const linesB = b.split('\n');
  const m = linesA.length;
  const n = linesB.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (linesA[i] === linesB[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = 0, j = 0;
  let lineA = 1, lineB = 1;
  while (i < m || j < n) {
    if (i < m && j < n && linesA[i] === linesB[j]) {
      result.push({ type: 'unchanged', content: linesA[i], lineA: lineA++, lineB: lineB++ });
      i++; j++;
    } else if (j < n && (i >= m || dp[i + 1][j] >= dp[i][j + 1])) {
      result.push({ type: 'added', content: linesB[j], lineB: lineB++ });
      j++;
    } else {
      result.push({ type: 'removed', content: linesA[i], lineA: lineA++ });
      i++;
    }
  }
  return result;
}

interface Props {
  original: string;
  edited: string;
  onRevert?: () => void;
}

export function DiffViewer({ original, edited, onRevert }: Props) {
  const diff = computeDiff(original, edited);
  const added = diff.filter(d => d.type === 'added').length;
  const removed = diff.filter(d => d.type === 'removed').length;
  const unchanged = diff.filter(d => d.type === 'unchanged').length;
  const identical = added === 0 && removed === 0;

  if (identical) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-700">No differences</p>
        <p className="text-xs text-slate-400 mt-1">Generated and edited content are identical</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            {added} added
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
            {removed} removed
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />
            {unchanged} unchanged
          </span>
        </div>
        {onRevert && (
          <button
            onClick={onRevert}
            className="text-xs text-amber-600 hover:text-amber-800 font-medium"
          >
            Revert to Generated
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-2 divide-x divide-slate-200">
          <div>
            <div className="sticky top-0 bg-slate-100 border-b border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Generated
            </div>
            {diff.map((line, i) => (
              <div
                key={`a-${i}`}
                className={`flex items-start font-mono text-xs leading-5 ${
                  line.type === 'removed' ? 'bg-red-50 text-red-800' :
                  line.type === 'added' ? 'bg-transparent text-transparent select-none' :
                  'text-slate-700'
                }`}
              >
                <span className="w-10 flex-shrink-0 text-right pr-3 text-slate-300 select-none py-0.5">
                  {line.lineA ?? ''}
                </span>
                <span className={`flex-1 px-2 py-0.5 whitespace-pre-wrap break-all ${line.type === 'removed' ? 'line-through' : ''}`}>
                  {line.type === 'added' ? '\u00A0' : line.content || '\u00A0'}
                </span>
              </div>
            ))}
          </div>

          <div>
            <div className="sticky top-0 bg-slate-100 border-b border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Edited
            </div>
            {diff.map((line, i) => (
              <div
                key={`b-${i}`}
                className={`flex items-start font-mono text-xs leading-5 ${
                  line.type === 'added' ? 'bg-emerald-50 text-emerald-800' :
                  line.type === 'removed' ? 'bg-transparent text-transparent select-none' :
                  'text-slate-700'
                }`}
              >
                <span className="w-10 flex-shrink-0 text-right pr-3 text-slate-300 select-none py-0.5">
                  {line.lineB ?? ''}
                </span>
                <span className="flex-1 px-2 py-0.5 whitespace-pre-wrap break-all">
                  {line.type === 'removed' ? '\u00A0' : line.content || '\u00A0'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
