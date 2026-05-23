import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center font-medium rounded-full transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-page disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-on-primary hover:bg-primary-soft active:bg-primary-soft",
  secondary:
    "bg-card text-ink border border-line hover:border-ink/40 active:border-ink/60",
  ghost: "text-ink hover:bg-card active:bg-card/80",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-base",
  lg: "h-12 px-6 text-base",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

interface ButtonProps
  extends CommonProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className"> {
  href?: never;
}

interface LinkProps extends CommonProps {
  href: string;
}

export function Button(props: ButtonProps | LinkProps) {
  const {
    variant = "primary",
    size = "md",
    className = "",
    children,
  } = props;
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${className}`.trim();

  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={cls}>
        {children}
      </Link>
    );
  }

  const { variant: _v, size: _s, className: _c, type, ...rest } = props as ButtonProps;
  void _v;
  void _s;
  void _c;
  return (
    <button type={type ?? "button"} className={cls} {...rest}>
      {children}
    </button>
  );
}
