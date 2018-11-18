import { Connection, createConnection } from "typeorm";


let connection: Promise<Connection> | null = null;
export async function getDatabaseConnection(): Promise<Connection> {
    if (!connection) {
        connection = createConnection();
    }
    return connection;
}
