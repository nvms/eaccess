export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ConfirmationExpiredError extends AuthError {
  constructor() {
    super("Confirmation token has expired");
  }
}

export class ConfirmationNotFoundError extends AuthError {
  constructor() {
    super("Confirmation token not found");
  }
}

export class EmailNotVerifiedError extends AuthError {
  constructor() {
    super("Email address has not been verified");
  }
}

export class EmailTakenError extends AuthError {
  constructor() {
    super("Email address is already in use");
  }
}

export class InvalidEmailError extends AuthError {
  constructor() {
    super("Invalid email address format");
  }
}

export class InvalidPasswordError extends AuthError {
  constructor() {
    super("Invalid password");
  }
}

export class InvalidTokenError extends AuthError {
  constructor() {
    super("Invalid token");
  }
}

export class ResetDisabledError extends AuthError {
  constructor() {
    super("Password reset is disabled for this account");
  }
}

export class ResetExpiredError extends AuthError {
  constructor() {
    super("Password reset token has expired");
  }
}

export class ResetNotFoundError extends AuthError {
  constructor() {
    super("Password reset token not found");
  }
}

export class TooManyResetsError extends AuthError {
  constructor() {
    super("Too many password reset requests");
  }
}

export class UserInactiveError extends AuthError {
  constructor() {
    super("User account is inactive");
  }
}

export class UserNotFoundError extends AuthError {
  constructor() {
    super("User not found");
  }
}

export class UserNotLoggedInError extends AuthError {
  constructor() {
    super("User is not logged in");
  }
}

// two-factor authentication errors

export class SecondFactorRequiredError extends AuthError {
  public availableMethods: {
    totp?: boolean;
    email?: { otpValue: string; maskedContact: string };
    sms?: { otpValue: string; maskedContact: string };
  };

  constructor(availableMethods: SecondFactorRequiredError["availableMethods"]) {
    super("Second factor authentication required");
    this.availableMethods = availableMethods;
  }
}

export class InvalidTwoFactorCodeError extends AuthError {
  constructor() {
    super("Invalid two-factor authentication code");
  }
}

export class TwoFactorExpiredError extends AuthError {
  constructor() {
    super("Two-factor authentication session has expired");
  }
}

export class TwoFactorNotSetupError extends AuthError {
  constructor() {
    super("Two-factor authentication is not set up for this account");
  }
}

export class TwoFactorAlreadyEnabledError extends AuthError {
  constructor() {
    super("Two-factor authentication is already enabled for this mechanism");
  }
}

export class InvalidBackupCodeError extends AuthError {
  constructor() {
    super("Invalid backup code");
  }
}

export class TwoFactorSetupIncompleteError extends AuthError {
  constructor() {
    super("Two-factor authentication setup is not complete");
  }
}
