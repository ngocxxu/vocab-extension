export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateEmail(email: string): void {
  if (!email || email.trim().length === 0) {
    throw new ValidationError('Email is required');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format');
  }
}

export function validatePassword(password: string, minLength = 8): void {
  if (!password || password.length === 0) {
    throw new ValidationError('Password is required');
  }

  if (password.length < minLength) {
    throw new ValidationError(
      `Password must be at least ${minLength} characters long`
    );
  }
}

export function validateNonEmptyString(value: string, fieldName: string): void {
  if (!value || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} is required`);
  }
}

export function validateName(name: string, fieldName: string): void {
  validateNonEmptyString(name, fieldName);

  if (name.length > 100) {
    throw new ValidationError(`${fieldName} must be less than 100 characters`);
  }

  const dangerousChars = /[<>"'&]/;
  if (dangerousChars.test(name)) {
    throw new ValidationError(`${fieldName} contains invalid characters`);
  }
}

export function validateEndpoint(endpoint: string): void {
  if (!endpoint || endpoint.trim().length === 0) {
    throw new ValidationError('Endpoint cannot be empty');
  }

  if (!endpoint.startsWith('/')) {
    throw new ValidationError("Endpoint must start with '/'");
  }
}

export function validateHexColor(color: string): void {
  if (!color || color.trim().length === 0) {
    throw new ValidationError('Color is required');
  }

  const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  if (!hexColorRegex.test(color)) {
    throw new ValidationError('Invalid hex color format');
  }
}

export function validateLanguageCode(code: string): void {
  if (!code || code.trim().length === 0) {
    throw new ValidationError('Language code is required');
  }

  if (code.length < 2 || code.length > 5) {
    throw new ValidationError(
      'Language code must be between 2 and 5 characters'
    );
  }

  const languageCodeRegex = /^[a-z]{2}(-[A-Z]{2})?$/;
  if (!languageCodeRegex.test(code)) {
    throw new ValidationError(
      "Invalid language code format (e.g., 'en' or 'en-US')"
    );
  }
}

export function validateSelectedText(
  text: string,
  minLength = 1,
  maxLength = 1000
): void {
  if (!text || text.trim().length === 0) {
    throw new ValidationError('Selected text cannot be empty');
  }

  const trimmedText = text.trim();
  if (trimmedText.length < minLength) {
    throw new ValidationError(
      `Selected text must be at least ${minLength} character(s) long`
    );
  }

  if (trimmedText.length > maxLength) {
    throw new ValidationError(
      `Selected text must be less than ${maxLength} characters`
    );
  }
}

export function validateUUID(id: string, fieldName: string): void {
  if (!id || id.trim().length === 0) {
    throw new ValidationError(`${fieldName} is required`);
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    throw new ValidationError(`Invalid ${fieldName} format`);
  }
}

export function validateToken(token: string, fieldName: string): void {
  if (!token || token.trim().length === 0) {
    throw new ValidationError(`${fieldName} is required`);
  }

  if (token.length < 10) {
    throw new ValidationError(`${fieldName} appears to be invalid`);
  }
}
