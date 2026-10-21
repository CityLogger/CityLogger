/** Supabase codes are stable; untrusted provider messages are not UI copy. */
export function authFeedback(error: unknown) {
  const code=(error as {code?:string})?.code;
  const messages:Record<string,string>={
    invalid_credentials:"The email or password is incorrect. Try again or reset your password.",
    email_not_confirmed:"Confirm your email before signing in. You can request a new code.",
    otp_expired:"This code has expired or is invalid. Request a new code and enter the latest one.",
    weak_password:"Choose a stronger password with at least eight characters.",
    over_email_send_rate_limit:"Please wait before requesting another email, then try again.",
    over_request_rate_limit:"Too many attempts. Wait a moment, then try again.",
    email_address_invalid:"Enter a valid email address.",
    user_already_exists:"An account already exists for this email. Sign in or reset your password.",
    same_password:"Choose a different password from your current one."
  };
  if(code && messages[code]) return messages[code];
  if(error instanceof TypeError) return "Could not connect. Check your connection and try again.";
  return "We couldn't complete this account request. Please try again, or contact support if it continues.";
}
