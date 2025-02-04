import { Table } from "../constants/global";
import { Announcement } from "../interface/Announcement";
import * as utils from "../utils/utils.db";
import { RowDataPacket } from "mysql2";
import * as mysql from "../db";
import { errorLogger } from "../utils/utils.error";
import { logHelper } from "../middleware/logger";
import { AccessLayer } from "../constants/global";
import { mail, mailTemplates } from "../middleware/mailer";

export const AnnouncementService = {
  async getAnnouncements() {
    const query =
      "SELECT a.announcementID, a.title, a.createdDate, u.username FROM announcement a JOIN users u ON a.userID = u.userID ORDER BY a.createdDate DESC";
    try {
      const [result] = await mysql.query(query, []);

      return result as Announcement[];
    } catch (error) {
      errorLogger({
        error: error,
        queryUsed: query,
        table: "announcement, users",
      });
    }
  },
  async getAnnouncement(id: number) {
    const query =
      "SELECT a.announcementID, a.title, a.content, a.createdDate, u.username FROM announcement a JOIN users u ON a.userID = u.userID WHERE a.announcementID= ?";
    try {
      const [result] = (await mysql.query(query, [id])) as RowDataPacket[];
      if (result) {
        return result[0] as Announcement;
      } else {
        return null;
      }
    } catch (error) {
      errorLogger({
        error: error,
        queryUsed: query,
        table: "announcement, users",
      });
    }
  },
  async createAnnouncement(announcement: Announcement) {
    const result = await utils.insert(
      Table.Announcement,
      ["title", "content", "userID"],
      [[announcement.title, announcement.content, announcement.userID]]
    );
    if (result > 0) {
      const mailOptions = await mailTemplates.allUser.announcementPosted(
        announcement.title,
        announcement.content,
        new Date().toLocaleString("en-CA", {
          day: "numeric",
          month: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "numeric",
        })
      );
      mail.sendMail(mailOptions, (error, info) => {
        if (error) {
          logHelper(
            "Send announcementPosted email : " + info,
            "createAnnouncement",
            AccessLayer.Services,
            error,
            true
          );
        } else {
          logHelper(
            "Send announcementPosted email : " + info,
            "createAnnouncement",
            AccessLayer.Services
          );
        }
      });
    }
    return result;
  },
  async deleteAnnouncement(id: number) {
    const result = await utils.remove(Table.Announcement, {
      column: "announcementID",
      value: id,
    });
    return result;
  },
};
