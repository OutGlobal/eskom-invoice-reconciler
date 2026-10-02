import React from "react";
import { LucideIcon, ArrowRight, UploadCloud } from "lucide-react";

export interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: LucideIcon;
  variant?: "primary" | "secondary" | "outline";
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  badge?: string;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  tertiaryAction?: EmptyStateAction;
  compact?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description = "Upload energy data to begin.",
  icon: Icon = UploadCloud,
  badge,
  primaryAction,
  secondaryAction,
  tertiaryAction,
  compact = false,
  className = "",
  children,
}) => {
  return (
    <div
      data-testid="empty-state"
      className={`rounded-xl border border-dashed border-primary/25 bg-muted/15 text-center flex flex-col items-center justify-center transition-all ${
        compact ? "p-6 space-y-3" : "p-10 md:p-14 space-y-4"
      } ${className}`}
    >
      {/* Icon Badge */}
      <div
        className={`rounded-full bg-primary/10 text-primary flex items-center justify-center shadow-inner ${
          compact ? "w-10 h-10" : "w-14 h-14"
        }`}
      >
        <Icon className={compact ? "w-5 h-5" : "w-7 h-7"} />
      </div>

      {/* Header & Description */}
      <div className="space-y-1.5 max-w-lg mx-auto">
        {badge && (
          <div className="inline-block mb-1">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wide uppercase bg-primary/10 text-primary border border-primary/20">
              {badge}
            </span>
          </div>
        )}
        <h3
          data-testid="empty-state-title"
          className={`font-bold tracking-tight text-foreground ${compact ? "text-sm" : "text-base md:text-lg"}`}
        >
          {title}
        </h3>
        {description && (
          <p
            data-testid="empty-state-description"
            className={`text-muted-foreground leading-relaxed ${compact ? "text-xs max-w-sm" : "text-xs md:text-sm"}`}
          >
            {description}
          </p>
        )}
      </div>

      {/* Custom Body / Extra Information */}
      {children}

      {/* Action Buttons */}
      {(primaryAction || secondaryAction || tertiaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
          {primaryAction &&
            (primaryAction.href ? (
              <a
                href={primaryAction.href}
                data-testid="empty-state-primary-action"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg shadow-sm hover:opacity-90 transition-opacity"
              >
                {primaryAction.icon && <primaryAction.icon className="w-3.5 h-3.5" />}
                <span>{primaryAction.label}</span>
                {!primaryAction.icon && <ArrowRight className="w-3.5 h-3.5 ml-0.5" />}
              </a>
            ) : (
              <button
                type="button"
                onClick={primaryAction.onClick}
                data-testid="empty-state-primary-action"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
              >
                {primaryAction.icon && <primaryAction.icon className="w-3.5 h-3.5" />}
                <span>{primaryAction.label}</span>
                {!primaryAction.icon && <ArrowRight className="w-3.5 h-3.5 ml-0.5" />}
              </button>
            ))}

          {secondaryAction &&
            (secondaryAction.href ? (
              <a
                href={secondaryAction.href}
                data-testid="empty-state-secondary-action"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-background border border-border text-foreground hover:bg-muted text-xs font-semibold rounded-lg shadow-2xs transition-colors"
              >
                {secondaryAction.icon && <secondaryAction.icon className="w-3.5 h-3.5" />}
                <span>{secondaryAction.label}</span>
              </a>
            ) : (
              <button
                type="button"
                onClick={secondaryAction.onClick}
                data-testid="empty-state-secondary-action"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-background border border-border text-foreground hover:bg-muted text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                {secondaryAction.icon && <secondaryAction.icon className="w-3.5 h-3.5" />}
                <span>{secondaryAction.label}</span>
              </button>
            ))}

          {tertiaryAction &&
            (tertiaryAction.href ? (
              <a
                href={tertiaryAction.href}
                data-testid="empty-state-tertiary-action"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
              >
                {tertiaryAction.icon && <tertiaryAction.icon className="w-3.5 h-3.5" />}
                <span>{tertiaryAction.label}</span>
              </a>
            ) : (
              <button
                type="button"
                onClick={tertiaryAction.onClick}
                data-testid="empty-state-tertiary-action"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-muted-foreground hover:text-foreground text-xs font-medium transition-colors cursor-pointer"
              >
                {tertiaryAction.icon && <tertiaryAction.icon className="w-3.5 h-3.5" />}
                <span>{tertiaryAction.label}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
};
