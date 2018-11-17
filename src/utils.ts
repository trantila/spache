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

function log(fn: (message: string, ...params) => void, message: string, ...params) {
    fn(`[${new Date().toISOString()}] ${message}`, params);
}

export function logError(message: string, ...params) {
    log(console.error, message, params);
}

// export function logWarning(message: string, ...params) {
//     log(console.warn, message, params);
// }

export function logInfo(message: string, ...params) {
    log(console.info, message, params);
}

// export function logDebug(message: string, ...params) {
//     log(console.debug, message, params);
// }
