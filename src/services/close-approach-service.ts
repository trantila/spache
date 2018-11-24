import { URL } from "url";
import { NeoApi, NeoApiObject, NeoApiFeedResult, NeoApiObjectsByDate, getNeosByDay } from "../neo-api";
import { getDateForFullDaysSinceEpoch, formatAsIsoDate, logError, addUTCDays, subUTCDays, differenceInUTCDays } from "../utils";
import { NeosByDayRepository } from "../neos-by-day-repository";
import { Connection } from "typeorm";


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
    const ndays = differenceInUTCDays(to, from);

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
            next: buildSpacheFeedUrl(origin, addUTCDays(from, ndays), addUTCDays(to, ndays)),
            self: buildSpacheFeedUrl(origin, from, to),
            prev: buildSpacheFeedUrl(origin, subUTCDays(from, ndays), subUTCDays(to, ndays)),
        },
        element_count: nobjects,
        near_earth_objects: dataResult,
    };
}


export class CloseApproachService {
    origin: URL;
    neoApi: NeoApi;
    dbConnection: Connection;

    constructor(origin: URL, neoApi: NeoApi, dbConnection: Connection) {
        this.origin = origin;
        this.neoApi = neoApi;
        this.dbConnection = dbConnection;
    }

    async queryByDateRange(from: Date, to: Date): Promise<NeoApiFeedResult> {
        const repository = new NeosByDayRepository(this.dbConnection.createEntityManager());
        const cachedResults = await repository.queryByDateRange(from, to);

        if (cachedResults)
            return buildNeoApiFeedResult(this.origin.origin, from, to, cachedResults);

        const feedResult = await this.neoApi.queryFeed(from, to);

        // Fire-and-forget the caching!
        this.dbConnection.transaction(entityManager => {
            const repository = new NeosByDayRepository(entityManager);
            const data = getNeosByDay({ start: from, end: to }, feedResult.near_earth_objects);
            return repository.update(data);
        })
        .catch((error: Error) => logError(error.message));

        // Set the navigation links to point back "here" instead of the NEO API
        // All the other links will still point to NEO API
        const links = feedResult.links;
        for (const key in links)
            links[key] = getSpachedUrl(this.origin, links[key]);
        return feedResult;
    }
}
