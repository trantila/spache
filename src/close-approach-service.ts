import { URL } from "url";
import { Between, Connection, In } from "typeorm";
import { addDays, subDays, differenceInDays } from "date-fns";
import { NeoApi, NeoApiObject, NeoApiFeedResult, NeoApiObjectsByDate } from "./neo-api";
import { getFullDaysSinceEpoch, getDateForFullDaysSinceEpoch, formatAsIsoDate, logError } from "./utils";
import { CloseApproachDate } from "./entity/close-approach-date";
import { CloseApproach } from "./entity/close-approach";


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
    dbConnection: Connection;

    constructor(origin: URL, neoApi: NeoApi, dbConnection: Connection) {
        this.origin = origin;
        this.neoApi = neoApi;
        this.dbConnection = dbConnection;
    }

    async queryByDateRange(from: Date, to: Date): Promise<NeoApiFeedResult> {
        const cachedResults = await this.queryCacheByDateRange(from, to);

        if (cachedResults)
            return buildNeoApiFeedResult(this.origin.origin, from, to, cachedResults);

        const feedResult = await this.neoApi.queryFeed(from, to);

        // Fire-and-forget the caching!
        const data = getNeosByDay(feedResult.near_earth_objects);
        this.updateCache(data)
            .catch((error: Error) => logError(error.message));

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
    async queryCacheByDateRange(from: Date, to: Date): Promise<NeosByDay | null> {
        const fromDay = getFullDaysSinceEpoch(from);
        const toDay = getFullDaysSinceEpoch(to);

        const closeApproachDateRepo = this.dbConnection.getRepository(CloseApproachDate);
        const dates = await closeApproachDateRepo.find({
            relations: ["closeApproaches"],
            where: { day: Between(fromDay, toDay) },
            order: { day: "ASC" },
        });

        // End-inclusive it is, as weird as it feels.
        // TODO Less aggressive cache-bypassing needed!
        const nexpected = toDay - fromDay + 1;
        if (dates.length < nexpected)
            return null;

        return dates.reduce((neosByDay, date) => {
            return Object.assign(neosByDay, {
                [date.day]: date.closeApproaches.map(approach => approach.nearEarthObject)
            });
        }, {} as NeosByDay);
    }

    async updateCache(data: NeosByDay) {
        const repo = this.dbConnection.getRepository(CloseApproachDate);

        // const days: number[] = [];
        const closeApproachDates: CloseApproachDate[] = [];
        for (const day in data) {
            // days.push(day as unknown as number);
            const closeApproachDate: CloseApproachDate = {
                day: day as unknown as number,
                closeApproaches: [],
            };

            closeApproachDate.closeApproaches = data[day].map(neo => {
                // TODO Picking first unconditionally seems like a bad idea!
                const approachData = neo.close_approach_data[0];
                // TODO Seems like a silly way to go around not setting the id...
                return Object.assign(new CloseApproach(), {
                    date: closeApproachDate,
                    closestDistanceAu: Number.parseFloat(approachData.miss_distance.astronomical),
                    orbitingBody: approachData.orbiting_body,
                    relativeVelocityKmps: Number.parseFloat(approachData.relative_velocity.kilometers_per_second),
                    nearEarthObject: neo,
                });
            });
            
            closeApproachDates.push(closeApproachDate);
        }

        // Delete all overlapping data in the crudest possible way before saving the new.
        // `repo.save` alone won't do presumably because typeorm cannot know that entities
        // with given ids exist in the db in this "free" case.
        await repo.delete({
            day: In(closeApproachDates.map(date => date.day)),
        });
        await repo.save(closeApproachDates);
    }
}
