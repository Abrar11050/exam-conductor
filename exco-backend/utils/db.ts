import { MongoClient, Db, Collection, Document, MongoClientOptions } from 'mongodb';
import { isMainThread } from 'worker_threads';

export type DBOPTIONS = {
    // contains indexes?: string[], uniqueIndexes?: string[]
    indexes?: string[];
    uniqueIndexes?: string[];

    // contains other optional stuffs
    [key: string]: any;
};

export class DBCon {
    private static database?:     Db;
    private static client:        MongoClient;
    private static dbName:        string;
    public  static collNames:     string[];
    public  static colls:         Collection<Document>[];
    private static connected:     boolean = false;
    private static indexes:       string[] = [];
    private static uniqueIndexes: string[] = [];

    public static connCount : number = 0;
    

    private constructor(url: string, dbName: string, collectionNames: string[], dbOptions?: DBOPTIONS) {
        DBCon.dbName    = dbName;
        DBCon.collNames = collectionNames;
        DBCon.colls     = new Array<Collection<Document>>(collectionNames.length);

        if(dbOptions && dbOptions.indexes && Array.isArray(dbOptions.indexes)) {
            DBCon.indexes = dbOptions.indexes;
        }
        
        if(dbOptions && dbOptions.uniqueIndexes && Array.isArray(dbOptions.uniqueIndexes)) {
            DBCon.uniqueIndexes = dbOptions.uniqueIndexes;
        }

        if(dbOptions) {
            delete dbOptions.indexes;
            delete dbOptions.uniqueIndexes;
        }

        DBCon.client = new MongoClient(url, dbOptions as MongoClientOptions);
    }

    public static initDatabse(url: string, dbName: string, collectionNames: string[], dbOptions?: DBOPTIONS) {
        if (!DBCon.database) {
            new DBCon(url, dbName, collectionNames, dbOptions);
        } else {
            throw new Error(`Database already initialized${isMainThread ? '' : ' (worker)'}`);
        }
    }

    static async connect() {
        await DBCon.client.connect();
        console.log(`[DB] Connected to database${isMainThread ? '' : ' (worker)'}`);
        DBCon.connected = true;
        DBCon.database = DBCon.client.db(DBCon.dbName);
        for (let i = 0; i < DBCon.collNames.length; i++) {
            DBCon.colls[i] = DBCon.database.collection(DBCon.collNames[i]);
        }
        Object.freeze(DBCon.collNames);
        Object.freeze(DBCon.colls);

        const dbCols = await DBCon.database.listCollections().toArray();
        const toMake = DBCon.collNames.filter((name) => {
            return !dbCols.some((col) => {
                return col.name === name;
            });
        });
        for (let i = 0; i < toMake.length; i++) {
            await DBCon.database.createCollection(toMake[i]);
            console.log(`[DB] Created collection "${toMake[i]}"${isMainThread ? '' : ' (worker)'}`);
        }

        await DBCon.makeIndexes(DBCon.indexes, false);
        await DBCon.makeIndexes(DBCon.uniqueIndexes, true);

        process.on('exit', () => {
            DBCon.client.close();
            console.log(`[DB] Disconnected from database${isMainThread ? '' : ' (worker)'}`);
        });

        DBCon.connCount++;
    }

    static async disconnect() {
        await DBCon.client.close();
        console.log(`[DB] Disconnected from database${isMainThread ? '' : ' (worker)'}`);
    }

    static async makeIndexes(indexes: string[], unique: boolean) {
        const ixMap = new Map<string, string[]>();
        for(let i = 0; i < indexes.length; i++) {
            const split = indexes[i].split('.');
            if(split.length < 2) throw new Error(`[DB] Invalid index "${indexes[i]}"${isMainThread ? '' : ' (worker)'}`);
            const collName = split.shift();
            const actualIndex = split.join('.');

            if(!collName) throw new Error(`[DB] Invalid index "${indexes[i]}"${isMainThread ? '' : ' (worker)'}`);

            if(ixMap.has(collName)) {
                ixMap.get(collName)?.push(actualIndex);
            } else {
                ixMap.set(collName, [actualIndex]);
            }
        }

        const mapKeys = [...ixMap.keys()];
        for(let i = 0; i < mapKeys.length; i++) {
            const collName = mapKeys[i];
            const intendedIndexes = ixMap.get(collName);

            const coll = DBCon.database?.collection(collName);
            if(!coll) throw new Error(`[DB] Collection "${collName}" does not exist${isMainThread ? '' : ' (worker)'}`);

            const currentIxs = await coll.listIndexes().toArray();
            const currentIndexes = currentIxs.map(v => Object.keys(v.key)).flat().filter(v => v !== '_id');
            const toMake = intendedIndexes?.filter(v => !currentIndexes.includes(v));
            
            for(let makeable of toMake ?? []) {
                await coll.createIndex(makeable, { unique });
                console.log(`[DB] Created index "${makeable}" on collection "${collName}"${isMainThread ? '' : ' (worker)'}`);
            }
        }
    }

    public static isConnected(): boolean {
        return DBCon.connected;
    }
}