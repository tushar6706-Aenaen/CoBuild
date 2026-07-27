import type { AuthErrorCode } from "@/lib/auth/redirects";

export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  provider_denied: "Sign-in was cancelled.",
  missing_code: "That sign-in link is missing something — try again.",
  invalid_code: "That sign-in link isn't valid — try again.",
  expired_link: "That link has expired. Request a new one below.",
  wrong_device: "Open the link on the same device and browser you requested it from.",
  server_error: "Something went wrong on our end. Try again in a moment.",
};

export function isAuthErrorCode(value: string | null): value is AuthErrorCode {
  return !!value && value in AUTH_ERROR_MESSAGES;
}
