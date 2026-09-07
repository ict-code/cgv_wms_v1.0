import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatQuantity(value: string | number): string {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

export function formatCurrency(value: string | number): string {
  return Number(value).toLocaleString(undefined, { style: "currency", currency: "PHP" });
}

export function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString();
}
