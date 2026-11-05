/** Junta classes CSS ignorando falsy. */
export const cx = (...xs: (string | false | null | undefined)[]): string => xs.filter(Boolean).join(' ');
