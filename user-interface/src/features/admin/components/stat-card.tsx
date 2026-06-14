import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  description?: string;
  color?: 'purple' | 'blue' | 'green' | 'amber' | 'red';
}

const colorMap = {
  purple: {
    bg: 'bg-purple-500/10',
    icon: 'text-purple-500',
    border: 'border-purple-500/20',
  },
  blue: {
    bg: 'bg-blue-500/10',
    icon: 'text-blue-500',
    border: 'border-blue-500/20',
  },
  green: {
    bg: 'bg-green-500/10',
    icon: 'text-green-500',
    border: 'border-green-500/20',
  },
  amber: {
    bg: 'bg-amber-500/10',
    icon: 'text-amber-500',
    border: 'border-amber-500/20',
  },
  red: {
    bg: 'bg-red-500/10',
    icon: 'text-red-500',
    border: 'border-red-500/20',
  },
};

export function StatCard({ icon: Icon, label, value, description, color = 'purple' }: StatCardProps) {
  const colors = colorMap[color];

  return (
    <div className={`rounded-xl border ${colors.border} bg-card p-6 transition-shadow hover:shadow-md`}>
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-lg ${colors.bg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-6 h-6 ${colors.icon}`} />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tracking-tight">{typeof value === 'number' ? value.toLocaleString() : value}</p>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
    </div>
  );
}
