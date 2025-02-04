import { Router } from "express";
import { getProgress } from "../controllers/progressOverview.controllers";

const router = Router();

router.route('/:groupId/:userId/:role/:year').get(getProgress);

export default router;