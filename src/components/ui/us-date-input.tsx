"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { formatUsDate, parseUsDate } from "@/lib/utils";

type UsDateInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "value" | "onChange"
> & {
  value: string;
  onValueChange?: (value: string) => void;
};

function maskUsDate(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function UsDateInput({
  value,
  onValueChange,
  placeholder = "MM/DD/YYYY",
  ...props
}: UsDateInputProps) {
  const [displayValue, setDisplayValue] = React.useState(() =>
    formatUsDate(value, "")
  );
  const lastEmittedValue = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (value === lastEmittedValue.current) {
      lastEmittedValue.current = null;
      return;
    }

    setDisplayValue(formatUsDate(value, ""));
  }, [value]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextDisplayValue = maskUsDate(event.target.value);
    const nextValue = parseUsDate(nextDisplayValue) || "";

    setDisplayValue(nextDisplayValue);
    lastEmittedValue.current = nextValue;
    onValueChange?.(nextValue);
  };

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      value={displayValue}
      onChange={handleChange}
    />
  );
}
