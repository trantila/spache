import * as express from "express";
import { Request, Response } from "express";
import { lastDayOfMonth } from "date-fns";
import { getDateParam, logError } from "../utils";
import { NeoApi } from "../neo-api";
import { getDatabaseConnection } from "../database";
import { CloseApproachAggregationsService } from "../services/close-approach-aggregations-service";


export function aggregationsRouter(nasaApiKey: string) {
    const router = express.Router();

    router.get("/largest/monthly", async (req: Request, res: Response) => {
        const from_ = getDateParam(req.query, "from");
    
        if (!from_) {
            res.status(400).send("Required parameter `from` not provided.");
        }
    
        const from = from_ as Date;
        const to = getDateParam(req.query, "to") || lastDayOfMonth(from);
    
        try {
            const neoApi = new NeoApi(nasaApiKey);
            const dbConnection = await getDatabaseConnection();
            const aggregationsService = new CloseApproachAggregationsService(neoApi, dbConnection);

            const feedResult = await aggregationsService.getMonthlyLargest(from, to);
            res.send(feedResult);
        } catch (err) {
            const errString = err.toString();
            logError(errString);
            res.status(500).send(errString);
        }
    });

    return router;
}
