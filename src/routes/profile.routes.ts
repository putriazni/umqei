import { Router } from "express";
import { getUserProfile } from "../controllers/userProfile.controller";

const router = Router();

router.route('/:userEmail').get(getUserProfile);

export default router;