import fetch from "node-fetch";
import { formatAsIsoDate, logInfo, getFullDaysSinceEpoch } from "./utils";
import { NeosByDay } from "./neos-by-day-repository";


export interface NeoApiCloseApproach {
    close_approach_date: string;
    epoch_date_close_approach: number;
    relative_velocity: {
        kilometers_per_second: string;
    };
    miss_distance: {
        astronomical: string;
    };
    orbiting_body: string;
}

export interface NeoApiObject {
    id: string;
    name: string;
    absolute_magnitude_h: number;
    estimated_diameter: {
        kilometers: {
            estimated_diameter_min: number;
            estimated_diameter_max: number;
        }
    };
    is_potentially_hazardous_asteroid: boolean;
    close_approach_data: NeoApiCloseApproach[];
    is_sentry_object: boolean;
}

export interface NeoApiObjectsByDate {
    [date: string]: NeoApiObject[];
}

export interface NeoApiFeedResult {
    links: {
        next: string;
        self: string;
        prev: string;
    };
    element_count: number
    near_earth_objects: NeoApiObjectsByDate;
}


const eightDaysMs = 8 * 24 * 60 * 60 * 1000;

function getDateComponent(date: Date): Date {
    // const isoDate = formatAsIsoDate(date);
    // return new Date(isoDate);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formFeedUrl(baseUrl: string, apiKey: string, from: Date, to: Date): string {
    return `${baseUrl}/feed?start_date=${formatAsIsoDate(from)}&end_date=${formatAsIsoDate(to)}&api_key=${apiKey}`;
}


// TODO Maybe this API should also be given "repository" treatment should expose
//      only NeosByDay outwards instead of the feed results..?
export function getNeosByDay(data: NeoApiObjectsByDate): NeosByDay {
    const result: NeosByDay = {};
    for (const isoDate in data) {
        const date = new Date(isoDate);
        const day = getFullDaysSinceEpoch(date)
        result[day] = data[isoDate];
    }
    return result;
}


export class NeoApi {
    public static readonly origin = "https://api.nasa.gov";
    public static readonly apiV1Fragment = "/neo/rest/v1"
    public static readonly feedPath = NeoApi.apiV1Fragment + "/feed";
    static readonly baseUrl = NeoApi.origin + NeoApi.apiV1Fragment;

    apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey
    }

    async queryFeed(from: Date, to: Date): Promise<NeoApiFeedResult> {
        from = getDateComponent(from);
        to = getDateComponent(to);
        const diffMs = to.getTime() - from.getTime();

        if (diffMs >= eightDaysMs)
            throw new Error("NEO API Allows querying of only week (eight days, though) at once.");

        const url = formFeedUrl(NeoApi.baseUrl, this.apiKey, from, to);

        logInfo(`Fetching from NEO with ${formatAsIsoDate(from)} - ${formatAsIsoDate(to)}`);

        const response = await fetch(url);

        if (!response.ok) {
            try {
                const text = await response.text();
                throw new Error(`NEO API responded with ${response.status} ${response.statusText}: ${text}`);
            } catch (error) {
                throw new Error(`NEO API responded with ${response.status} ${response.statusText} and no text-parseable body.`);
            }
        }

        return await response.json();
    }
}
