import { useViewMode } from '../context/ViewModeContext';
import { formatPKR } from '../utils/format';

interface Props {
  farmValue: number;
  className?: string;
  showLabel?: boolean;
}

export default function CurrencyDisplay({ farmValue, className = '', showLabel = false }: Props) {
  const { mode, selectedPartnerName } = useViewMode();

  const displayValue = mode === 'partner' ? Math.round(farmValue / 3) : farmValue;
  const label = mode === 'partner' && showLabel && selectedPartnerName
    ? `${selectedPartnerName}'s Share`
    : null;

  return (
    <span className={className}>
      {label && <span className="text-xs text-primary-400 block mb-0.5">{label}</span>}
      {formatPKR(displayValue)}
    </span>
  );
}
