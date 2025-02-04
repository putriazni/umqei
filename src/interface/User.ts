export interface User extends Group {
    userID: number;
    userEmail: string;
    username: string;
    userStatus: number | boolean;
    assignTo?: {
        ptjGroupID: number;
        yearSession: string;
    }[] | null;
    lastLoginDate: string;
    lastAnnouncementDate: string;
    grouping?: Group[];  
}

export interface Group {
    groupID: number;
    groupName: string;
    role: string;
    groupStatus?: number | boolean;
    auditorUserIDs?: number[];
    ptjAcademic: number | boolean;
    // assignedAuditor?: {
    //     auditorUserID: number;
    // }[] | null;
    head?: boolean;
}

export interface AuditorPtjComments {
    auditorUserID: number;
    ptjGroupID: number;
    yearSession: string;
    comment: string;
}

export interface UserGroupSet {
    userID: number,
    groupID: number,
    head: number
}