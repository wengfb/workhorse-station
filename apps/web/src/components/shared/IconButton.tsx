import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

type IconButtonVariant = "secondary" | "primary" | "success" | "danger" | "info";
type IconButtonSize = "xs" | "sm" | "md";

const variantClassName: Record<IconButtonVariant, string> = {
  secondary: "app-button-secondary border",
  primary: "app-button-primary",
  success: "app-button-success border",
  danger: "app-button-danger border",
  info: "app-button-info border"
};

const sizeClassName: Record<IconButtonSize, string> = {
  xs: "h-6 w-6 rounded",
  sm: "h-7 w-7 rounded-md",
  md: "h-8 w-8 rounded-lg"
};

const iconSizeClassName: Record<IconButtonSize, string> = {
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4"
};

export function IconButton({
  icon: Icon,
  label,
  variant = "secondary",
  size = "sm",
  className,
  type = "button",
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: LucideIcon;
  label: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
}) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variantClassName[variant],
        sizeClassName[size],
        className
      )}
      {...props}
    >
      <Icon className={iconSizeClassName[size]} aria-hidden="true" />
    </button>
  );
}

