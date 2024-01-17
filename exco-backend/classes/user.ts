import { ObjectId, MongoServerError } from 'mongodb';
import bcrypt from 'bcrypt';
import { WithOID, Result } from '../utils/common';
import { DBCon } from '../utils/db';
import { COL_USER } from '../utils/decls';

export enum UserRole {
    STUDENT = 0,
    TEACHER = 1
}

export interface User extends WithOID {
    firstName?: string,
    lastName?:  string,
    email?:     string,
    password?:  string,
    role?:      UserRole
}

export class UserOps {
    static async create(user: User): Promise<Result<boolean>> {
        try {
            user.password = bcrypt.hashSync(user.password as string, 10);
            await DBCon.colls[COL_USER].insertOne(user);
            return Result.success<boolean>(true);
        } catch(e) {
            if(e instanceof MongoServerError && e.code === 11000) {
                return Result.success<boolean>(false, "User already exists");
            } else {
                console.error(e);
                return Result.failure<boolean>("Failed to create user").setExtra(500);
            }
        }
    }

    static async authorize(email: string, password: string): Promise<Result<User | null>> {
        try {
            const user = await DBCon.colls[COL_USER].findOne({ email });
            if (user === null) {
                return Result.success<User | null>(null, `No user exists with email ${email}`);
            } else {
                if (bcrypt.compareSync(password, user.password)) {
                    user.password = void 0;
                    return Result.success<User | null>(user);
                } else {
                    return Result.success<User | null>(null, "Incorrect password");
                }
            }
        } catch(e) {
            console.error(e);
            return Result.failure<User | null>("Failed to authorize user").setExtra(500);
        }
    }

    static async update(user: User): Promise<Result<void>> {
        // deny changing of _id, email, role
        const { email, role, _id, ...update } = user;
        try {
            const res = await DBCon.colls[COL_USER].updateOne({ _id }, { $set: update });
            if (res.matchedCount === 0) {
                return Result.failure<void>("No user exists with the given id").setExtra(404);
            } else if(res.modifiedCount === 0) {
                return Result.failure<void>("No changes made").setExtra(406);
            } else {
                return Result.success<void>(void 0);
            }
        } catch(e) {
            console.error(e);
            return Result.failure<void>("Failed to update user").setExtra(500);
        }
    }

    static async erase(id: ObjectId): Promise<Result<void>> {
        try {
            await DBCon.colls[COL_USER].deleteOne({ _id: id });
            return Result.success<void>(void 0);
        } catch(e) {
            console.error(e);
            return Result.failure<void>("Failed to erase user").setExtra(500);
        }
    }

    static async getInfo(id: ObjectId): Promise<Result<User>> {
        try {
            // don't return password
            const user = await DBCon.colls[COL_USER].findOne({ _id: id }, { projection: { password: 0 } });
            if (user === null) {
                return Result.failure<User>(`No user exists with id ${id}`).setExtra(404);
            } else {
                return Result.success<User>(user as User);
            }
        } catch(e) {
            console.error(e);
            return Result.failure<User>("Failed to get user info").setExtra(500);
        }
    }
}
