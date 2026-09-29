import { cn } from "@/lib/utils";
import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes } from "react";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="eyebrow text-muted-foreground">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "h-11 w-full rounded-md border border-input bg-surface px-3 text-base outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputClass, props.className)} />;
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputClass, "pr-8", props.className)} />;
}

export function Btn({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger";
}) {
  const styles = {
    primary:
      "bg-primary text-primary-foreground hover:bg-primary/90 font-bold uppercase tracking-wide",
    outline: "border border-input hover:bg-secondary font-semibold",
    ghost: "hover:bg-secondary text-muted-foreground hover:text-foreground font-semibold",
    danger: "text-destructive hover:bg-destructive/10 font-semibold",
  }[variant];
  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-11 items-center justify-center rounded-md px-5 text-sm transition-colors disabled:opacity-60",
        styles,
        className,
      )}
    />
  );
}

export function SectionTitle({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return (
    <div>
      {eyebrow ? <p className="eyebrow text-primary">{eyebrow}</p> : null}
      <h2 className="mt-2 text-2xl sm:text-3xl">{title}</h2>
    </div>
  );
}
