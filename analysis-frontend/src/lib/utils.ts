import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PersonName {
  lastName: string;
  firstName: string;
  middleName: string | null;
}

/** "Иванов Иван Иванович" — отчество опционально. */
export function formatFullName(p: PersonName): string {
  return [p.lastName, p.firstName, p.middleName].filter(Boolean).join(" ");
}

/** "Иванов И. И." — фамилия + инициалы. */
export function formatShortName(p: PersonName): string {
  const fi = p.firstName ? `${p.firstName[0]}.` : "";
  const mi = p.middleName ? ` ${p.middleName[0]}.` : "";
  return `${p.lastName}${fi || mi ? " " : ""}${fi}${mi}`;
}
