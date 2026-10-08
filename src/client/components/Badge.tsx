import type { HTMLAttributes, ReactNode } from "react";

export type BadgeVariant = "low" | "medium" | "high" | "overdue" | "neutral";

type BadgeProps = {
  variant: BadgeVariant;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLSpanElement>, "children" | "className">;

export const Badge = ({ variant, children, ...rest }: BadgeProps) => (
  <span {...rest} className={`badge badge--${variant}`}>
    {children}
  </span>
);
