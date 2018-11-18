import { Connection, Between, createConnection } from "typeorm";
import { CloseApproachDate } from "./entity/close-approach-date";


let connection: Promise<Connection> | null = null;
export async function getDatabaseConnection(): Promise<Connection> {
    if (!connection) {
        connection = createConnection();
    }
    return connection;
}
