export interface UserProfile {
    userID: number;
    userEmail: string;
    username: string;
    userStatus: number | boolean;
    lastLoginDate: string;
    lastAnnouncementDate: string;
    membership: GroupMember[];
}

export interface GroupMember {
    groupID: number;
    groupName: string;
    role: string;
    ptjAcademic: boolean;
    head: boolean;
}