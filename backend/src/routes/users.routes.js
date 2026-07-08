import {Router} from "express";
import { 
    addToHistory, 
    getUserHistory, 
    getUserProfile, 
    updateMeetingHistory, 
    deleteMeetingFromHistory, 
    firebaseLogin
} from "../controllers/user.controller.js";
import rateLimit from "express-rate-limit";

const router=Router();

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 attempts per windowMs
    message: { message: "Too many authentication attempts. Please try again after 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
});

router.route("/firebase-login").post(authLimiter, firebaseLogin);

router.route("/add_to_activity").post(addToHistory);
router.route("/get_all_activity").get(getUserHistory);
router.route("/get_user_profile").get(getUserProfile);
router.route("/update_activity").post(updateMeetingHistory);
router.route("/delete_activity").post(deleteMeetingFromHistory);

export default router;