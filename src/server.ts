import { URL } from "url";import * as express from "express";
import { Request, Response } from "express";
import * as morgan from "morgan";
import { addDays } from "date-fns";
import { NeoApi } from "./neo-api";
import { logError, logInfo } from "./utils";
import { CloseApproachService } from "./close-approach-service";
import { getDatabaseConnection } from "./database";


const hostname = "localhost";
const port = 3000;
const host = `${hostname}:${port}`;
// TODO HTTPS would rock :)
const origin = new URL(`http://${host}`);
const nasaApiKey = process.env["SPACHE_NASA_API_KEY"] || "DEMO_KEY";


function getRawParam(query: object, paramName: string): string | null {
    const raw: string | undefined = query[paramName];
    return raw === undefined ? null : raw;
}

function getDateParam(query: object, paramName: string): Date | null {
    const raw = getRawParam(query, paramName);
    return raw ? new Date(raw) : null;
}


const server = express();

server.use(morgan("[:date[iso]] :method :url :status :response-time ms - :res[content-length]"));

server.get("/", async (_req: Request, res: Response) => {
    const connection = await getDatabaseConnection();
    res.send(`Space Cache | Connected to: ${connection.driver.database}: ${connection.isConnected}`);
});

server.get("/neo/rest/v1/feed", async (req: Request, res: Response) => {
    const from_ = getDateParam(req.query, "start_date");

    if (!from_) {
        res.status(400).send("Required parameter `start_date` not provided.");
    }

    const from = from_ as Date;
    const to = getDateParam(req.query, "end_date") || addDays(from, 7);

    try {
        const neoApi = new NeoApi(nasaApiKey);
        const dbConnection = await getDatabaseConnection();
        const closeApproachService = new CloseApproachService(origin, neoApi, dbConnection);

        const feedResult = await closeApproachService.queryByDateRange(from, to);
        res.send(feedResult);
    } catch (err) {
        const errString = err.toString();
        logError(errString);
        console.error(`[${new Date().toISOString()}] ${errString}`);
        res.status(500).send(errString);
    }
});

server.listen(port, hostname, async () => {
    logInfo(`Listening at ${host}`);
    logInfo(`Using NASA API KEY "${nasaApiKey}"`);
    const connection = await getDatabaseConnection();
    logInfo(`Connected to ${connection.driver.database}`);
});
