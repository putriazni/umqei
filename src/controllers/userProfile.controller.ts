import * as mysql from "../db";
import { Request, Response } from "express";
import { GroupMember, UserProfile } from "../interface/UserMembership";
import { UserService } from "../services/userService";
import { logHelper } from "../middleware/logger";
import { AccessLayer } from "../constants/global";

export async function getUserProfile(req: Request, res: Response) {
  const userEmail = decodeURIComponent(req.params.userEmail);

  try {
    const result = await UserService.profileInfoQuery(userEmail);
    const lastAnnouncementDate = await UserService.getLastAnnouncementDate();
    if (result.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const profileInfo: UserProfile = {
        userID: result[0].userID,
        userEmail: result[0].userEmail,
        username: result[0].username,
        userStatus: result[0].userStatus === 1 ? true : false,
        lastLoginDate: result[0].lastLoginDate,
        lastAnnouncementDate: lastAnnouncementDate,
        membership: result[0].membership,
      };
    const query = `UPDATE users SET lastLoginDate = NOW() WHERE userID = ?`;
    await mysql.query(query, [profileInfo.userID]);
    res.json(profileInfo);
    logHelper(
      `GET ${req.originalUrl}`,
      "getUserProfile",
      AccessLayer.Controllers
    );
  } catch (error) {
    console.error("Error fetching user profile info:", error);
    res.status(500).json({ message: "Error fetching user profile info" });
    logHelper(
      `GET ${req.originalUrl}`,
      "getUserProfile",
      AccessLayer.Controllers,
      error,
      true
    );
  }
}

export async function getUserProfileInternal(userEmail: string) {
  try {
    const result = await UserService.profileInfoQuery(userEmail);
    const lastAnnouncementDate = await UserService.getLastAnnouncementDate();
    if (result.length === 0) {
      return null;
    }
    const membership : GroupMember[] = result.map((row : any) => {
        return {
          groupID: row.groupID,
          groupName: row.groupName,
          role: row.role,
          ptjAcademic: row.ptjAcademic === 1 ? true : false,
          head: row.head === 1 ? true : false,
        };
      });
    const profileInfo: UserProfile = {
        userID: result[0].userID,
        userEmail: result[0].userEmail,
        username: result[0].username,
        userStatus: result[0].userStatus === 1 ? true : false,
        lastLoginDate: result[0].lastLoginDate,
        lastAnnouncementDate: lastAnnouncementDate,
        membership: membership,
      };

    await UserService.updateLastLoginDate(profileInfo.userID);
    logHelper(
      `Authorization Attempt`,
      "getUserProfileInternal",
      AccessLayer.Controllers
    );
    return profileInfo;
  } catch (error) {
    console.error("Error fetching user profile info:", error);
    logHelper(
      `Authorization Attempt`,
      "getUserProfileInternal",
      AccessLayer.Controllers,
      error,
      true
    );
    throw error;
  }
}
