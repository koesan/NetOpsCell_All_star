import { forwardRef, useId, type InputHTMLAttributes, type LabelHTMLAttributes, type SelectHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, label, error, id, ...props }, ref) => {
  // id verilmezse bile label <-> input eslesmesi (erisilebilirlik + form testleri icin) korunur.
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-navy-700">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          "h-10 rounded-xl border border-navy-100 bg-white px-3.5 text-sm text-navy-900 placeholder:text-navy-300",
          "transition-shadow focus:outline-none focus:ring-4 focus:ring-navy-100 focus:border-navy-300",
          error && "border-priority-kritik focus:ring-red-100",
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-priority-kritik">{error}</span>}
    </div>
  );
});
Input.displayName = "Input";

export function FieldLabel(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className="text-xs font-medium text-navy-700" {...props} />;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ className, label, id, children, ...props }, ref) => {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-xs font-medium text-navy-700">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={cn(
          "h-10 rounded-xl border border-navy-100 bg-white px-3.5 text-sm text-navy-900",
          "transition-shadow focus:outline-none focus:ring-4 focus:ring-navy-100 focus:border-navy-300",
          className
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  );
});
Select.displayName = "Select";
