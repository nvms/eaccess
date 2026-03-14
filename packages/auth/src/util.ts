import { InvalidEmailError } from "./errors.js";

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateEmail = (email: string): void => {
  if (typeof email !== "string") {
    throw new InvalidEmailError();
  }
  if (!email.trim()) {
    throw new InvalidEmailError();
  }
  if (!isValidEmail(email)) {
    throw new InvalidEmailError();
  }
};

export const createMapFromEnum = (enumObj: Record<string, number>) => Object.fromEntries(Object.entries(enumObj).map(([key, value]) => [value, key]));
