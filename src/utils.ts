import { format } from "date-fns";


// Dates

export function formatAsIsoDate(date: Date): string {
    return format(date, "yyyy-MM-dd");
}

export function getFullDaysSinceEpoch(date: Date): number {
    const ms = date.getTime();
    const days = ms / (1000.0 * 60 * 60 * 24);
    return Math.floor(days);
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
