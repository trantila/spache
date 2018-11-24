
// Query params

function getRawParam(query: object, paramName: string): string | null {
    const raw: string | undefined = query[paramName];
    return raw === undefined ? null : raw;
}

/**
 * Get a `Date` param by name.
 *
 * TODO TZ handling likely very broken!
 * @param query query params hash
 * @param paramName key of param to extract
 */
export function getDateParam(query: object, paramName: string): Date | null {
    const raw = getRawParam(query, paramName);
    return raw ? new Date(raw) : null;
}


// Dates

const dayms = 1000.0 * 60 * 60 * 24;

export function formatAsIsoDate(date: Date): string {
    // date-fns format is a no go since it deals in local time...
    const year = date.getUTCFullYear().toString().padStart(4, '0');
    const month = (date.getUTCMonth()+1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function addUTCDays(date: Date, amount: number): Date {
    const newDate = new Date(date);
    newDate.setUTCDate(date.getUTCDate() + amount);
    return newDate;
}

export function subUTCDays(date: Date, amount: number): Date {
    return addUTCDays(date, -amount);
}

export function differenceInUTCDays(left: Date, right: Date): number {
    const dms = left.getTime() - right.getTime();
    return Math.floor(dms / dayms);
}

export function getFullDaysSinceEpoch(date: Date): number {
    const ms = date.getTime();
    return Math.floor(ms / dayms);
}

export function getDateForFullDaysSinceEpoch(days: number): Date {
    const ms = Math.floor(days) * 24 * 60 * 60 * 1000;
    return new Date(ms);
}


// Logging

function log(fn: (message: string) => void, message: string) {
    fn(`[${new Date().toISOString()}] ${message}`);
}

export function logError(message: string) {
    log(console.error, message);
}

// export function logWarning(message: string) {
//     log(console.warn, message);
// }

export function logInfo(message: string) {
    log(console.info, message);
}

// export function logDebug(message: string) {
//     log(console.debug, message);
// }
