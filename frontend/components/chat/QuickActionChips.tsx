interface QuickActionChipsProps {
  chips: string[];
  onChipClick: (chip: string) => void;
}

const DEFAULT_CHIPS = ['Log expense', 'Log income', 'Check budget', 'Monthly summary', 'Get advice'];

export default function QuickActionChips({ chips, onChipClick }: QuickActionChipsProps) {
  const items = chips.length > 0 ? chips : DEFAULT_CHIPS;

  return (
    <div className="flex flex-wrap gap-2 px-4 py-2">
      {items.map((chip) => (
        <button
          key={chip}
          onClick={() => onChipClick(chip)}
          className="px-3 py-1.5 text-xs font-medium rounded-full border border-purple-200 dark:border-purple-800/40 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
        >
          {chip}
        </button>
      ))}
    </div>
  );
}
