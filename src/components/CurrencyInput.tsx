"use client";

import { useState, useEffect, useCallback } from "react";

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string | number;
  onChange: (value: string) => void;
  allowPercent?: boolean;
}

export default function CurrencyInput({
  value,
  onChange,
  className = "",
  placeholder = "0.00",
  name,
  allowPercent = false,
  ...props
}: CurrencyInputProps) {
  const formatNumber = useCallback((val: string | number | undefined | null) => {
    if (val === "" || val === undefined || val === null) return "";
    const strVal = val.toString();
    if (allowPercent && strVal.includes("%")) return strVal;
    
    const num = typeof val === "string" ? parseFloat(val.replace(/,/g, "")) : val;
    if (isNaN(num)) return "";
    return new Intl.NumberFormat("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  }, [allowPercent]);

  const [mounted, setMounted] = useState(false);
  const [displayValue, setDisplayValue] = useState("");

  useEffect(() => {
    setMounted(true);
    setDisplayValue(formatNumber(value));
  }, [formatNumber, value]);

  useEffect(() => {
    if (!mounted) return;
    const formatted = formatNumber(value);
    
    // Only update if the parent value actually represents a different number
    // than what we're currently displaying. This prevents jumping while typing.
    const currentNum = parseFloat(displayValue.replace(/,/g, ""));
    const nextNum = typeof value === "string" ? parseFloat(value.replace(/,/g, "")) : value;

    // Treat NaN (empty) and 0 as equivalent for comparison to prevent jump back to 0.00
    const normalizedCurrent = isNaN(currentNum) ? 0 : currentNum;
    const normalizedNext = isNaN(nextNum) ? 0 : nextNum;

    if (normalizedCurrent !== normalizedNext) {
      setDisplayValue(formatted);
    } else if (allowPercent && typeof value === "string" && value.includes("%") && displayValue !== value) {
      // Handle percent case specifically
      setDisplayValue(value);
    }
  }, [value, mounted, formatNumber, displayValue, allowPercent]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    
    // Allow digits, commas, one decimal point, and optionally a percent sign at the end
    const regex = allowPercent ? /^[0-9,.]*%?$/ : /^[0-9,.]*$/;
    
    if (val === "" || regex.test(val)) {
      setDisplayValue(val);
      
      // Pass the clean value back to parent
      // If it ends with a dot or is just a percent, don't clean it yet so user can continue typing
      let cleanVal = val.replace(/,/g, "");
      
      // If parent expects a number (like in NewListingPage), 
      // they might do Number(cleanVal). We should be careful.
      onChange(cleanVal);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setDisplayValue(formatNumber(displayValue));
    if (props.onBlur) props.onBlur(e);
  };

  return (
    <input
      type="text"
      name={name}
      value={mounted ? displayValue : ""}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
      placeholder={placeholder}
      {...props}
    />
  );
}
