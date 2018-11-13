import * as express from "express";
import { Request, Response } from "express";
import { addDays } from "date-fns";
import { URL } from "url";
import { NeoApi } from "./neo-api";


const hostname = "localhost";
const port = 3000;
const host = `${hostname}:${port}`;
const nasaApiKey = process.env["SPACHE_NASA_API_KEY"] || "DEMO_KEY";


function getRawParam(query: object, paramName: string): string | null {
    const raw: string | undefined = query[paramName];
    return raw === undefined ? null : raw;
}

function getDateParam(query: object, paramName: string): Date | null {
    const raw = getRawParam(query, paramName);
    return raw ? new Date(raw) : null;
}

function getSpachedUrl(neoUrl: string): string {
    const url = new URL(neoUrl);
    // TODO HTTPS would rock :)
    url.protocol = "http";
    url.host = host;
    url.searchParams.delete("api_key");
    // TODO Expose detailed?
    url.searchParams.delete("detailed");
    url.search = url.searchParams.toString();
    return url.toString();
}


const app = express();

app.get("/", function(req: Request, res: Response) {
    res.send("Hello, world!");
});

app.get("/neo/rest/v1/feed", async (req: Request, res: Response) => {
    const from = getDateParam(req.query, "start_date");

    if (!from) {
        res.status(400).send("Required parameter `start_date` not provided.");
    }

    const to = getDateParam(req.query, "end_date") || addDays(from, 7);

    const neoApi = new NeoApi(nasaApiKey);

    try {
        const feedResult = await neoApi.queryFeed(from, to);
        // Set the navigation links to point back "here" instead of the NEO API
        // All the other links will still point to NEO API
        const links = feedResult.links;
        for (const key in links)
            links[key] = getSpachedUrl(links[key]);
        res.send(feedResult);
    } catch (err) {
        const errString = err.toString();
        console.error(`[${new Date().toISOString()}] ${errString}`);
        res.status(500).send(errString);
    }
});

app.listen(port, hostname, () => {
    console.log(`Listening at ${host}`);
    console.log(`Using NASA API KEY "${nasaApiKey}"`);
});
