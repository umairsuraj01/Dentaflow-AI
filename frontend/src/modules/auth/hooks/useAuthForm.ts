// useAuthForm.ts — Form state and validation logic for auth forms.
// REACT NATIVE READY: no DOM dependencies.

import { useState, useCallback } from 'react';
import { PASSWORD_RULES } from '../constants/auth.constants';

interface FormErrors {
  [key: string]: string;
}

export function useAuthForm<T extends Record<string, unknown>>(initialValues: T) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setValue = useCallback(
    (field: keyof T, value: T[keyof T]) => {
      setValues((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field as string];
        return next;
      });
    },
    [],
  );

  const setError = useCallback((field: string, message: string) => {
    setErrors((prev) => ({ ...prev, [field]: message }));
  }, []);

  const validateEmail = useCallback((email: string): boolean => {
    if (!email) {
      setError('email', 'Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('email', 'Invalid email address');
      return false;
    }
    return true;
  }, [setError]);

  const validatePassword = useCallback((password: string): boolean => {
    if (!password) {
      setError('password', 'Password is required');
      return false;
    }
    const failedRule = PASSWORD_RULES.find((rule) => !rule.test(password));
    if (failedRule) {
      setError('password', failedRule.label);
      return false;
    }
    return true;
  }, [setError]);

  const validateRequired = useCallback(
    (field: string, label: string): boolean => {
      if (!values[field]) {
        setError(field, `${label} is required`);
        return false;
      }
      return true;
    },
    [values, setError],
  );

  const getPasswordStrength = useCallback((password: string): number => {
    return PASSWORD_RULES.filter((rule) => rule.test(password)).length;
  }, []);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setIsSubmitting(false);
  }, [initialValues]);

  return {
    values,
    errors,
    isSubmitting,
    setIsSubmitting,
    setValue,
    setError,
    setErrors,
    validateEmail,
    validatePassword,
    validateRequired,
    getPasswordStrength,
    reset,
  };
}
