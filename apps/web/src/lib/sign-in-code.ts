interface AuthError {
  code?: string;
  message?: string;
  status?: number;
}

export const CODE_LENGTH = 6;

export function signInCodeError(error: AuthError) {
  switch (error.code) {
    case "SIGNUPS_CLOSED":
      return "Sign-ups are closed.";
    case "INVALID_OTP":
      return "That code isn't right. Check the email and try again.";
    case "OTP_EXPIRED":
      return "That code has expired. Send a new one.";
    case "TOO_MANY_ATTEMPTS":
      return error.status === 429 && error.message
        ? error.message
        : "Too many wrong codes. Send a new one.";
    default:
      return error.message ?? "Something went wrong. Try again.";
  }
}
