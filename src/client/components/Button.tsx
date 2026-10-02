import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** true면 스피너를 보여 주고 비활성화한다 (중복 제출 방지) */
  isLoading?: boolean;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className">;

// md는 기본 크기라 별도 클래스가 없다
const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "btn--sm",
  md: "",
  lg: "btn--lg",
};

export const Button = ({
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled,
  type = "button",
  children,
  ...rest
}: ButtonProps) => {
  const className = ["btn", `btn--${variant}`, SIZE_CLASS[size]].filter(Boolean).join(" ");

  return (
    <button
      {...rest}
      type={type}
      className={className}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
    >
      {isLoading ? <span className="btn-spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
};
