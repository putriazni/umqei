import { FileFormat } from "./File";

export interface Announcement {
    // announcementID: number;
    title: string;
    content: string;
    // createdDate: string;
    userID: number;
    attachments: FileFormat[];
}

export interface Attachment {
    attachmentID: number;
    filename: string;
    announcementID: number;
    filepath: string;
}