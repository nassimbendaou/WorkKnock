import { cn } from '@/lib/utils';
import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: boolean;
}

export function Card({ className, children, padding = true, ...props }: CardProps) {
  return (
    <div className={cn('card', padding && 'p-6', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center justify-between mb-4', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-base font-semibold text-slate-900 dark:text-white', className)} {...props}>
      {children}
    </h3>
  );
}

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  color?: 'primary' | 'green' | 'blue' | 'orange' | 'red' | 'purple';
  onClick?: () => void;
}

const colorMap = {
  primary: 'from-[var(--color-primary-500)] to-[var(--color-primary-700)]',
  green: 'from-green-500 to-green-700',
  blue: 'from-blue-500 to-blue-700',
  orange: 'from-orange-500 to-orange-700',
  red: 'from-red-500 to-red-700',
  purple: 'from-purple-500 to-purple-700',
};

export function KpiCard({ title, value, subtitle, icon, trend, color = 'primary', onClick }: KpiCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl p-5 text-white bg-gradient-to-br shadow-lg',
        colorMap[color],
        onClick && 'cursor-pointer hover:shadow-xl transition-shadow',
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-white/80">{title}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
          {subtitle && <p className="mt-0.5 text-xs text-white/70">{subtitle}</p>}
          {trend && (
            <div className="mt-2 flex items-center gap-1">
              <span className={cn('text-xs font-medium', trend.value >= 0 ? 'text-green-300' : 'text-red-300')}>
                {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-white/60">{trend.label}</span>
            </div>
          )}
        </div>
        <div className="p-2.5 rounded-lg bg-white/20 backdrop-blur-sm">{icon}</div>
      </div>
      <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-white/10" />
    </div>
  );
}
