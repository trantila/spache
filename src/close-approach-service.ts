import { URL } from "url";
import { addDays, subDays, differenceInDays } from "date-fns";
import { NeoApi, NeoApiObject, NeoApiFeedResult, NeoApiObjectsByDate } from "./neo-api";
import { getFullDaysSinceEpoch, getDateForFullDaysSinceEpoch, formatAsIsoDate, logError } from "./utils";
import { NeosByDayRepository } from "./neos-by-day-repository";


interface NeosByDay {
    [day: number]: NeoApiObject[];
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

function getNeosByDay(data: NeoApiObjectsByDate): NeosByDay {
    const result: NeosByDay = {};
    for (const isoDate in data) {
        // TODO TZs!
        const date = new Date(isoDate);
        const day = getFullDaysSinceEpoch(date)
        result[day] = data[isoDate];
    }
    return result;
}


export class CloseApproachService {
    origin: URL;
    neoApi: NeoApi;
    repository: NeosByDayRepository;

    constructor(origin: URL, neoApi: NeoApi, repository: NeosByDayRepository) {
        this.origin = origin;
        this.neoApi = neoApi;
        this.repository = repository;
    }

    async queryByDateRange(from: Date, to: Date): Promise<NeoApiFeedResult> {
        const cachedResults = await this.repository.queryByDateRange(from, to);

        if (cachedResults)
            return buildNeoApiFeedResult(this.origin.origin, from, to, cachedResults);

        const feedResult = await this.neoApi.queryFeed(from, to);

        // Fire-and-forget the caching!
        const data = getNeosByDay(feedResult.near_earth_objects);
        this.repository.update(data)
            .catch((error: Error) => logError(error.message));

        // Set the navigation links to point back "here" instead of the NEO API
        // All the other links will still point to NEO API
        const links = feedResult.links;
        for (const key in links)
            links[key] = getSpachedUrl(this.origin, links[key]);
        return feedResult;
    }
}
