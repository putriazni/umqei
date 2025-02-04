import { Announcement } from "../interface/Announcement";
import { Request, Response } from "express";
import { AnnouncementService } from "../services/announcementService";
import { FileService } from "../services/fileService";
import fs from "fs";
import dotenv from "dotenv";
import { logHelper } from "../middleware/logger";
import { AccessLayer } from "../constants/global";

dotenv.config();
export async function getAnnouncements(req: Request, res: Response) {
  try {
    const announcements = await AnnouncementService.getAnnouncements();
    res.json(announcements);
    logHelper(
      `GET ${req.originalUrl}`,
      "getAnnouncements",
      AccessLayer.Controllers
    );
  } catch (error) {
    res.status(500).json({ message: "Error fetching announcements" });
    logHelper(
      `GET ${req.originalUrl}`,
      "getAnnouncements",
      AccessLayer.Controllers,
      error,
      true
    );
  }
}

export async function getAnnouncement(req: Request, res: Response) {
  //example usage http://localhost:5000/announcements/1
  //get a specific announcement with content using announcementID. To be used in AnnouncementContent component
  try {
    const id = Number(req.params.id);
    const announcement = await AnnouncementService.getAnnouncement(id);
    const attachments = await FileService.getAttachmentInfo(id);

    if (announcement) {
      res.status(200).json({
        ...announcement,
        attachments,
      });
      logHelper(
        `GET ${req.originalUrl}`,
        "getAnnouncement",
        AccessLayer.Controllers
      );
    } else {
      const error = { message: "Announcement not found" };
      logHelper(
        `GET ${req.originalUrl}`,
        "getAnnouncement",
        AccessLayer.Controllers,
        error,
        true
      );
      return res.status(404).json(error);
    }
  } catch (error) {
    res.status(500).json({ message: "Error fetching announcement" });
    logHelper(
      `GET ${req.originalUrl}`,
      "getAnnouncement",
      AccessLayer.Controllers,
      error,
      true
    );
  }
}

export async function createAnnouncement(req: Request, res: Response) {
  //example usage http://localhost:5000/announcements/add with raw body { "title": "test", "content": "test", "userID": 1 }
  try {
    const newAnnouncement: Announcement = req.body;
    const newInsertAnnouncementId =
      await AnnouncementService.createAnnouncement(newAnnouncement);

    let result = 0;
    if (
      Array.isArray(newAnnouncement.attachments) &&
      newAnnouncement.attachments.length > 0
    ) {
      result = await FileService.createAttachment(
        newInsertAnnouncementId,
        newAnnouncement.attachments
      );
    }

    if (newInsertAnnouncementId) {
      const announcementInfo = await AnnouncementService.getAnnouncement(
        newInsertAnnouncementId
      );

      if (result === newAnnouncement.attachments.length) {
        logHelper(
          `POST ${req.originalUrl}`,
          "createAnnouncement",
          AccessLayer.Controllers
        );
        return res.status(200).json({
          ...announcementInfo,
          attachments: newAnnouncement.attachments,
        });
      } else if (result === 0) {
        logHelper(
          `POST ${req.originalUrl}`,
          "createAnnouncement",
          AccessLayer.Controllers
        );
        return res.status(200).json({
          ...announcementInfo,
        });
      }
    }
  } catch (error) {
    res.status(500).json({ message: "Error creating announcement" });
    logHelper(
      `POST ${req.originalUrl}`,
      "createAnnouncement",
      AccessLayer.Controllers,
      error,
      true
    );
  }
}

export async function deleteAnnouncement(req: Request, res: Response) {
  //example usage http://localhost:5000/announcements/delete?announcementID=5
  const id = Number(req.query.announcementID);
  try {
    const announcement = await AnnouncementService.getAnnouncement(id);

    if (!announcement) {
      const error = { message: "Announcement not found" };
      logHelper(
        `POST ${req.originalUrl}`,
        "deleteAnnouncement",
        AccessLayer.Controllers,
        error,
        true
      );
      return res.status(404).json(error);
    }
    const result = await AnnouncementService.deleteAnnouncement(id);
    const attachmentPath =
      process.env.UPLOADS_DIRECTORY + "/resources/attachment/" + id + "/";
    if (fs.existsSync(attachmentPath)) {
      fs.rmSync(attachmentPath, { recursive: true });
    }
    if (result) {
      logHelper(
        `POST ${req.originalUrl}`,
        "deleteAnnouncement",
        AccessLayer.Controllers
      );
      return res
        .status(200)
        .json({ message: "Announcement deleted successfully" });
    } else {
      throw new Error(`Error deleting announcement : id ${id}`);
    }
  } catch (error) {
    res.status(500).json({ message: "Error deleting announcement" });
    logHelper(
      `POST ${req.originalUrl}`,
      "deleteAnnouncement",
      AccessLayer.Controllers,
      error,
      true
    );
  }
}
