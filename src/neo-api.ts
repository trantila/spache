import fetch from "node-fetch";


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

export interface NeoApiFeedResult {
    links: {
        next: string;
        self: string;
        prev: string;
    };
    element_count: number
    near_earth_objects: {
        [date: string]: NeoApiObject[];
    };
}


const eightDaysMs = 8 * 24 * 60 * 60 * 1000;

// TODO JS and timezones..?

function getDateComponent(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatAsIsoDate(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
}

function formFeedUrl(baseUrl: string, apiKey: string, from: Date, to: Date): string {
    return `${baseUrl}/feed?start_date=${formatAsIsoDate(from)}&end_date=${formatAsIsoDate(to)}&api_key=${apiKey}`;
}

export class NeoApi {
    apiKey: string;
    baseUrl = "https://api.nasa.gov/neo/rest/v1";

    constructor(apiKey: string) {
        this.apiKey = apiKey
    }

    async queryFeed(from: Date, to: Date): Promise<NeoApiFeedResult> {
        from = getDateComponent(from);
        to = getDateComponent(to);
        const diffMs = to.getTime() - from.getTime();

        if (diffMs >= eightDaysMs)
            throw new Error("NEO API Allows querying of only a week at once.");

        const url = formFeedUrl(this.baseUrl, this.apiKey, from, to);
        const response = await fetch(url);

        if (!response.ok)
            throw new Error(`NEO API responded with ${response.status} ${response.statusText}: ${response.body}`);

        return await response.json();
    }
}
