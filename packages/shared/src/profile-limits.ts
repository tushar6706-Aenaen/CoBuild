/**
 * Length caps for free-text profile fields.
 *
 * These live here rather than as inline `.slice()` literals in the server
 * actions because the form and the server have to agree on them. When they
 * didn't, the server quietly truncated — a 400-character bio was cut to 280
 * on save with no warning before and no notice after, so the writer never
 * learned the text was gone.
 *
 * The server still truncates: `maxLength` is a client affordance and any
 * caller can post past it. The point is that the form now stops you at the
 * same number the server would have cut you at, and says so.
 *
 * Mobile reuses these too — same fields, same caps.
 */
export const DISPLAY_NAME_MAX = 80;
export const HEADLINE_MAX = 120;
export const BIO_MAX = 280;
export const LOCATION_MAX = 120;
export const TIMEZONE_MAX = 60;
export const COLLEGE_MAX = 120;
