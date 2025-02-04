import express, { Application, json } from "express";
import morgan from "morgan";
import cors from "cors";
import dotenv from "dotenv";
import { scheduleJob } from "node-schedule";
import AnnouncementRoutes from "./routes/announcement.routes";
import DashboardRoutes from "./routes/dashboard.routes";
import FormDetailsRoutes from "./routes/formDetails.routes";
import FormEditRoutes from "./routes/formEdit.routes";
import ResponseRoutes from "./routes/response.routes";
import UserRoutes from "./routes/user.routes";
import ProgressRoutes from "./routes/progress.routes";
import PeriodRoutes from "./routes/period.routes";
import ProfileRoutes from "./routes/profile.routes";
import ReportingRoutes from "./routes/reporting.routes";
import UploadRoutes from "./routes/file.routes";
import CommentRoutes from "./routes/comment.routes";
import {
  checkAndClone,
  extractClonedForm,
  isNewSessionStart,
  removeIdleFiles,
  checkAndNotifyExpiring
} from "./controllers/schedular.controllers";
import { ScheduledJobType } from "./constants/dataType";
import { requestResponseLoggerMiddleware } from "./middleware/logger";
import { Period } from "./interface/Period";
import { filterUpcomingSession } from "./controllers/period.controllers";
import { PeriodService } from "./services/periodService";
import session, * as expressSession from "express-session";
import expressMySqlSession from "express-mysql-session";
import passport from "passport";
import { Strategy as GoogleStrategy, Profile } from "passport-google-oauth20";
import { UserService } from "./services/userService";
import { getUserProfileInternal } from "./controllers/userProfile.controller";
import { logHelper } from "./middleware/logger";
import { AccessLayer } from "./constants/global";
import isAuthenticated from "./middleware/authCheck";
import { UserProfile } from "./interface/UserMembership";

dotenv.config();
const MySQLStore = expressMySqlSession(expressSession);
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT as unknown as number,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  createDatabaseTable: false,
});

export class App {
  private app: Application;
  private static scheduledJob: ScheduledJobType | null = null;
  private static nextSelfAuditStartDate: Date | null = null;
  private static sessionQueue: Period[] | null = null;

  constructor(private port: number | string) {
    this.app = express();
    this.app.enable("trust proxy");
    this.middlewares();
    this.passport();
    this.settings();
    this.routes();
    this.scheduleJobs();
  }

  settings() {
    this.app.set("port", this.port || process.env.PORT || 5000);
  }

  middlewares() {
    this.app.use(
      session({
        cookie: {
          maxAge: 604800000,
          //equivalent to 7 days, 7*24*60*60*1000milliseconds
          // secure: true,
          sameSite: "strict"
        },
        proxy: true, // add this when behind a reverse proxy, if need secure cookies
        resave: false,
        saveUninitialized: false, //if we have not initialized (which means to touch or modify) a session, we do not want to save it
        rolling: true,
        secret: process.env.SESSION_SECRET as string,
        store: sessionStore,
      })
    );
    //after having session, req.session will be available
    this.app.use(morgan("dev"));
    this.app.use(
      cors({
        origin: "http://localhost:3000",
        credentials: true,
      })
    );
    this.app.use(json());
    this.app.use(requestResponseLoggerMiddleware);
  }

  passport() {
    this.app.use(passport.initialize());
    this.app.use(passport.session());
    passport.serializeUser(function (user, cb) {
      cb(null, user);
    });
    passport.deserializeUser(function (obj: any, cb) {
      cb(null, obj);
    });
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID as string,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
          callbackURL: "/auth/google/callback",
          //proxy : true
        },
        async (accessToken, refreshToken, profile: Profile, done) => {
          try {
            if (profile.emails && profile.emails.length > 0) {
              let existingUser = await getUserProfileInternal(
                profile.emails[0].value
              );
              if (existingUser) {
                //update username based on google profile
                if (existingUser.username !== profile.displayName) {
                  await UserService.updateUsername(
                    profile.emails[0].value,
                    profile.displayName
                  );
                  existingUser = {
                    ...existingUser,
                    username: profile.displayName,
                  };
                }
                return done(null, existingUser);
              }
            }
            return done(null, false, {
              message: "Unauthorized email address",
            });
          } catch (err) {
            console.log(err);
            return done(err as Error, false);
          }
        }
      )
    );

    this.app.get(
      "/auth/login/success",
      async (req, res) => {
        if (req.isAuthenticated()) {
          const user = req.user as UserProfile;
          if (user.userID && user.userID > 0) {
            const dates = await UserService.getLastLoginAnnouncementDate(
              user.userID
            );
            if (dates) {
              user.lastLoginDate = dates.lastLoginDate;
              user.lastAnnouncementDate = dates.lastAnnouncementDate;
            }
            await UserService.updateLastLoginDate(user.userID);
          }
          res.status(200).json({
            error: false,
            message: "Login successful",
            user: user,
          });
        } else {
          res.status(401).json({ error: true, message: "User not logged in" });
        }
      } //used to check if user is logged in, if yes, return user info
    );

    this.app.get("/auth/login/error", function (req, res) {
      res
        .status(401)
        .redirect((process.env.CLIENT_URL + "/login?failed=true") as string);
    }); //This happens when user is from not a shortlisted user

    this.app.get(
      "/auth/google",
      passport.authenticate("google", {
        scope: ["profile", "email"],
        prompt: "select_account",
      })
    ); //call this to login

    this.app.get(
      "/auth/google/callback",
      passport.authenticate("google", {
        successRedirect: process.env.CLIENT_URL as string,
        failureRedirect: "/auth/login/error",
      })
    );

    this.app.get("/auth/logout", function (req, res) {
      logHelper(
        `GET ${req.originalUrl}`,
        "Logout : " + JSON.stringify(req.session),
        AccessLayer.Controllers
      );
      req.session.destroy((err) => {
        if (err) {
          console.log(err);
          logHelper(
            `GET ${req.originalUrl}`,
            "Logout",
            AccessLayer.Controllers,
            err,
            true
          );
        }
        res
          .clearCookie("connect.sid")
          .redirect(process.env.CLIENT_URL as string);
      });
    });
  }

  routes() {
    this.app.use("/api", isAuthenticated, (req, res, next) => {
      next();
    });
    this.app.use("/api/announcements", AnnouncementRoutes);
    this.app.use("/api/dashboard", DashboardRoutes);
    this.app.use("/api/forms", FormEditRoutes);
    this.app.use("/api/details", FormDetailsRoutes);
    this.app.use("/api/response", ResponseRoutes);
    this.app.use("/api/users", UserRoutes);
    this.app.use("/api/progress", ProgressRoutes);
    this.app.use("/api/period", PeriodRoutes);
    this.app.use("/api/profile", ProfileRoutes);
    this.app.use("/api/reporting", ReportingRoutes);
    this.app.use("/api", UploadRoutes);
    this.app.use("/api/comments", CommentRoutes);
  }

  async scheduleJobs() {
    scheduleJob("removeIdleFiles + checkAndNotifyExpiring", "0 0 0 * * *", async () => {
      console.log("Running removeIdleFiles() and checkAndNotifyExpiring() on: " + new Date());
      await removeIdleFiles();
      await checkAndNotifyExpiring();
    });
    await App.checkStartupOngoingSession();
    const alreadyInitiated = await App.updateQueue();
    if (!alreadyInitiated) App.initiateSessionJob();
  }

  static initiateSessionJob() {
    if (App.nextSelfAuditStartDate) {
      App.scheduledJob?.cancel();
      App.scheduledJob = scheduleJob(
        "cloneForms " + App.nextSelfAuditStartDate,
        App.nextSelfAuditStartDate,
        async () => {
          console.log("Running cloneForms on: " + new Date());
          const currentSession = await isNewSessionStart();
          if (currentSession) {
            const formPeriodSet = await extractClonedForm(currentSession);
            if (formPeriodSet) {
              await checkAndClone(currentSession, formPeriodSet, true);
            }
          }
          await App.updateQueue();
        }
      );
    }
  }

  static async updateQueue() {
    const latestQueue = await filterUpcomingSession();
    if (latestQueue.length > 0) {
      App.sessionQueue = latestQueue;
      App.nextSelfAuditStartDate = new Date(
        App.sessionQueue[0].selfAuditStartDate
      );
      App.initiateSessionJob();
      return true;
    } else {
      App.sessionQueue = null;
      App.nextSelfAuditStartDate = null;
      App.scheduledJob?.cancel();
      App.scheduledJob = null;
    }
    return false;
  }

  static async checkStartupOngoingSession() {
    const currentPeriod = await PeriodService.getCurrentPeriodSession();
    const currentYearSession: Period = currentPeriod[0] as Period;
    if (!currentYearSession) {
      return;
    }
    const formPeriodSet = await extractClonedForm(
      currentYearSession.yearSession
    );
    if (formPeriodSet) {
      await checkAndClone(currentYearSession.yearSession, formPeriodSet, true);
    }
  }

  static toCronExpression(date: Date) {
    return `${date.getMinutes()} ${date.getHours()} ${date.getDate()} ${
      date.getMonth() + 1
    } *`;
  }

  async listen() {
    this.app.listen(5000);
    console.log("Server running on port", this.app.get("port"));
  }
}
