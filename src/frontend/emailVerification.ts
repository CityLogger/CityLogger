// Keep this in sync with Supabase Authentication → Email OTP length.
export const emailOtpLength = 8;

export const cleanEmailOtpInput = (value: string) =>
  value.replace(/\D/g, "").slice(0, emailOtpLength);
