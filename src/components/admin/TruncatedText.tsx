"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TruncatedTextProps {
  value?: string | null;
  maxChars?: number;
  className?: string;
}

export function TruncatedText({
  value,
  maxChars = 28,
  className,
}: TruncatedTextProps) {
  const text = value?.trim() || "-";
  const shouldTruncate = text.length > maxChars;
  const visibleText = shouldTruncate
    ? `${text.slice(0, Math.max(maxChars - 3, 1))}...`
    : text;

  if (!shouldTruncate) {
    return <span className={className}>{text}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-block max-w-full cursor-default", className)}>
          {visibleText}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs break-words">{text}</TooltipContent>
    </Tooltip>
  );
}
