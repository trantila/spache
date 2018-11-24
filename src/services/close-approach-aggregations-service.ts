import { NeoApi, getNeosByDay, NeoApiObject } from "../neo-api";
import { NeosByDayRepository, NeosByDay } from "../neos-by-day-repository";
import { compareAsc, min, format } from "date-fns";
import { logError, getDateForFullDaysSinceEpoch, logInfo, addUTCDays, formatAsIsoDate, DateWindow } from "../utils";
import { Connection } from "typeorm";


export interface NeoByIsoMonth {
    [month: string]: NeoApiObject;
}

function getFetchWindows(from: Date, to: Date): DateWindow[] {
    const windows: DateWindow[] = [];
    for (let date = from; compareAsc(to, date) >= 0; date = addUTCDays(date, 7)) {
        windows.push({
            start: date,
            // NASA API is end-inclusive
            end: min([addUTCDays(date, 6), to]),
        });
    }
    return windows;
}

function formatIsoMonth(date: Date): string {
    return format(date, "yyyy-MM");
}

export class CloseApproachAggregationsService {
    neoApi: NeoApi;
    dbConnection: Connection;

    constructor(neoApi: NeoApi, dbConnection: Connection) {
        this.neoApi = neoApi;
        this.dbConnection = dbConnection;
    }

    /**
     * Get largest NEOs by month.
     * 
     * TODO The overly pessimistic cache strategy will hurt bad here!
     * 
     * TODO Aggregation should be done in SQL (likely even with sqlite)
     *      with windowing.
     * 
     * @param from date starting from, can be non-first day of month
     * @param to date ending to, can be non-last day of month
     */
    async getMonthlyLargest(from: Date, to: Date): Promise<NeoByIsoMonth> {
        // Ideas for better logic:
        // 1) Query all the dates in range
        // 2) Check for missing windows and fetch'n'store only those
        // 3) Perform SQL wizardry
        // 4) ...
        // 5) Profit!
        // X) Should probably check that the caller is not trying to aggregate
        //    since year 1 AD or even the 70's.
        // X) If the caller is "only" trying to fetch a decade or so worth of data,
        //    maybe issue a 202 and something, something, something..?

        const repo = new NeosByDayRepository(this.dbConnection.createEntityManager());
        let neosByDay = await repo.queryByDateRange(from, to);

        if (!neosByDay) {
            logInfo(`Aggregation data not completely in cache between ${formatAsIsoDate(from)} - ${formatAsIsoDate(to)}`);

            const fetchWindows = getFetchWindows(from, to);
            const windowedNeosByDay_ = fetchWindows.map(window =>
                this.neoApi.queryFeed(window.start, window.end)
                .then(feedResult => getNeosByDay(window, feedResult.near_earth_objects)));

            const windowedNeosByDay = await Promise.all(windowedNeosByDay_);
            neosByDay = windowedNeosByDay.reduce((neosByDay, window) => Object.assign(neosByDay, window), {});

            let minDay = Number.MAX_SAFE_INTEGER, maxDay = Number.MIN_SAFE_INTEGER;
            for (const day in neosByDay) {
                minDay = Math.min(minDay, day as unknown as number);
                maxDay = Math.max(maxDay, day as unknown as number);
            }

            const minDate = getDateForFullDaysSinceEpoch(minDay);
            const maxDate = getDateForFullDaysSinceEpoch(maxDay);
            console.log(`Range: ${minDay} - ${maxDay}`);
            console.log(`Or ..: ${minDate.toISOString()} - ${maxDate.toISOString()}`);

            // Fire and forget the caching
            this.dbConnection.transaction(entityManager => {
                var repository = new NeosByDayRepository(entityManager);
                return repository.update(neosByDay as NeosByDay)
                .then(_ => logInfo(`Stored ${formatAsIsoDate(from)} - ${formatAsIsoDate(to)}`));
            })
            .catch((error: Error) => logError(error.message));
        }

        let largestByMonth: NeoByIsoMonth = {}
        for (const key in neosByDay) {
            const day = key as unknown as number;
            const neos = neosByDay[day];
            largestByMonth = neos.reduce((largestByMonth, neo) => {
                const date = getDateForFullDaysSinceEpoch(day);
                const isoMonth = formatIsoMonth(date);
                const largestSoFar: NeoApiObject | undefined  = largestByMonth[isoMonth];
                
                if (!largestSoFar
                        || neo.estimated_diameter.kilometers > largestSoFar.estimated_diameter.kilometers) {
                    largestByMonth[isoMonth] = neo;
                }

                return largestByMonth;
            }, largestByMonth);
        }

        return largestByMonth;
    }
}
