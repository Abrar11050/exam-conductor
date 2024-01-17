export enum UserRole {
    UNKNOWN = -1,
    
    STUDENT = 0,
    TEACHER = 1
}

export class User {
    public firstName: string;
    public lastName:  string;
    public email:     string;
    public password?: string;
    public role:      UserRole;

    public constructor(
        firstName: string,
        lastName:  string,
        email:     string,
        role:      UserRole,
        password:  string | undefined,
    ) {
        this.firstName = firstName;
        this.lastName  = lastName;
        this.email     = email;
        this.role      = role;
        this.password  = password;
    }

    public static fromJSON(json: any): User {

        return new User(
            'firstName' in json ? json.firstName : '',
            'lastName'  in json ? json.lastName  : '',
            'email'     in json ? json.email     : '',
            'role'      in json ? json.role      : UserRole.UNKNOWN,
            'password'  in json ? json.password  : undefined
        );
    }
}