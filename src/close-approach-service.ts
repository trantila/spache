import { NeoApi, NeoApiObject, NeoApiFeedResult, NeoApiObjectsByDate } from "./neo-api";
import { URL } from "url";
import { getFullDaysSinceEpoch, getDateForFullDaysSinceEpoch, formatAsIsoDate } from "./utils";
import { addDays, subDays, differenceInDays } from "date-fns";

interface NeosByDay {
    [day: number]: NeoApiObject[];
}

// TODO One cheap key-value store. Key is "days since epoch".
//      Existence of a key means the day has been fetched.
const db = {} as NeosByDay;

function updateDatabase(db: NeosByDay, data: NeoApiObjectsByDate) {
    // Overweite all received days
    for (const isoDate in data) {
        // TODO TZs!
        const date = new Date(isoDate);
        const day = getFullDaysSinceEpoch(date);
        db[day] = data[isoDate];
    }
}

function getSpachedUrl(origin: URL, neoUrl: string): string {
    const url = new URL(neoUrl);
    url.protocol = origin.protocol;
    url.host = origin.host;
    url.searchParams.delete("api_key");
    // TODO Expose detailed?
    url.searchParams.delete("detailed");
    url.search = url.searchParams.toString();
    return url.toString();
}

function buildSpacheFeedUrl(origin: string, from: Date, to: Date): string {
    return `${origin}${NeoApi.feedPath}?start_date=${formatAsIsoDate(from)}&end_date=${formatAsIsoDate(to)}`;
}

function buildNeoApiFeedResult(origin: string, from: Date, to: Date, data: NeosByDay): NeoApiFeedResult {
    const ndays = differenceInDays(to, from);

    let nobjects = 0;
    const dataResult: NeoApiObjectsByDate = {};
    for (const day in data) {
        const objects = data[day];
        nobjects += objects.length;

        // TS does not like numbers as hash keys...
        const date = getDateForFullDaysSinceEpoch(day as unknown as number);
        const key = formatAsIsoDate(date);
        dataResult[key] = objects;
    }

    return {
        links: {
            next: buildSpacheFeedUrl(origin, addDays(from, ndays), addDays(to, ndays)),
            self: buildSpacheFeedUrl(origin, from, to),
            prev: buildSpacheFeedUrl(origin, subDays(from, ndays), subDays(to, ndays)),
        },
        element_count: nobjects,
        near_earth_objects: dataResult,
    };
}


export class CloseApproachService {
    origin: URL;
    neoApi: NeoApi;

    constructor(origin: URL, neoApi: NeoApi) {
        this.origin = origin;
        this.neoApi = neoApi;
    }

    async queryByDateRange(from: Date, to: Date): Promise<NeoApiFeedResult> {
        const cachedResults = this.queryCacheByDateRange(from, to);

        if (cachedResults)
            return buildNeoApiFeedResult(this.origin.origin, from, to, cachedResults);

        const feedResult = await this.neoApi.queryFeed(from, to);

        // TODO cache processing could be fired to background; client does not care of it.
        updateDatabase(db, feedResult.near_earth_objects);

        // Set the navigation links to point back "here" instead of the NEO API
        // All the other links will still point to NEO API
        const links = feedResult.links;
        for (const key in links)
            links[key] = getSpachedUrl(this.origin, links[key]);
        return feedResult;
    }

    /**
     * Get cached close-approaches on date range or null if refresh is needed.
     * Any missing day will cause a full refresh.
     * @param from date
     * @param to date, inclusive
     */
    queryCacheByDateRange(from: Date, to: Date): NeosByDay | null {
        const fromDay = getFullDaysSinceEpoch(from);
        const toDay = getFullDaysSinceEpoch(to);

        // End-inclusive it is, as weird as it feels.
        let results: NeosByDay = {};
        for (let day = fromDay; day <= toDay; ++day) {
            const resultsOfDay = db[day];

            // Return null directly if any day is missing!
            if (!resultsOfDay)
                return null;

            results[day] = resultsOfDay;
        }

        return results;
    }
}
