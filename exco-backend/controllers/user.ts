import { needsAuth, onRoute, queryParam, bodyValue, jwtValue, STRKEYOBJ } from "../express-extend/extend";

import { MinLength, ValidRole, IsMongoID } from "../express-extend/helpers";

import jsonwebtoken from "jsonwebtoken";

import { ObjectId } from "mongodb";

import { Request, Response } from "express";

import { User, UserOps } from '../classes/user';

import { Result } from "../utils/common";

const JWT_SECRET = process.env.JWT_SECRET as string;

export const deocodeJWT = (bearerHeader: string, req: Request, res: Response): STRKEYOBJ => {
    const fields = bearerHeader.split(' ');
    if(fields.length < 2 || fields[0] !== 'Bearer') {
        return {};
    } else {
        const [role, id] = jsonwebtoken.verify(fields[1], JWT_SECRET).split('|');
        res.setHeader('User-Role', role);
        return { role: parseInt(role), id };
    }
};

export class UserService {
    @onRoute('/api/register', 'POST')
    async register(
        @bodyValue('firstName', true, { convertTo: String, validate: MinLength(1) }) firstName: string,
        @bodyValue('lastName',  true, { convertTo: String, validate: MinLength(1) }) lastName:  string,
        @bodyValue('email',     true, { convertTo: String, validate: MinLength(4) }) email:     string,
        @bodyValue('password',  true, { convertTo: String, validate: MinLength(4) }) password:  string,
        @bodyValue('role',      true, { convertTo: Number, validate: ValidRole    }) role:      number
    ) {
        const res = await UserOps.create({
            firstName, lastName,
            email, password, role
        });

        return res;
    }

    @onRoute('/api/login', 'POST')
    async login(
        @bodyValue('email',    true, { convertTo: String, validate: MinLength(4) }) email:    string,
        @bodyValue('password', true, { convertTo: String, validate: MinLength(4) }) password: string
    ) {
        const res = await UserOps.authorize(email, password);
        if(!res.ok) return res;

        if(res.data) {
            try {
                const { _id, role } = res.data;
                const token = jsonwebtoken.sign(`${role?.toString()}|${_id?.toString()}`, JWT_SECRET);
                return {
                    id:        _id,
                    firstName: res.data.firstName,
                    lastName:  res.data.lastName,
                    email:     res.data.email,
                    role:      res.data.role,
                    token:     token
                };
            } catch(err) {
                return Result.failure('Failed to generate token').setExtra(500);
            }
        } else {
            return res;
        }
    }

    @onRoute('/api/userupdate', 'POST')
    @needsAuth()
    async userUpdate(
        @jwtValue('id')                                                                      id: string,
        @bodyValue('firstName', false, { convertTo: String, validate: MinLength(1) }) firstName: string,
        @bodyValue('lastName',  false, { convertTo: String, validate: MinLength(1) })  lastName: string,
        @bodyValue('password',  false, { convertTo: String, validate: MinLength(4) })  password: string,
    ) {

        const update : User = { _id: new ObjectId(id) };

        firstName && (update.firstName = firstName);
        lastName  && (update.lastName  = lastName);
        password  && (update.password  = password);

        const res = await UserOps.update(update);

        return res;
    }

    @onRoute('/api/userinfo', 'GET')
    async userInfo(
        @queryParam('id', true, { convertTo: String, validate: IsMongoID }) id: string
    ) {
        const res = await UserOps.getInfo(new ObjectId(id));

        return res;
    }
}