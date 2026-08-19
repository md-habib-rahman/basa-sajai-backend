import { auth } from "../config/auth.js";

/**
 * Express middleware to authenticate session via Better Auth
 */
export const requireAuth = async (req, res, next) => {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session || !session.user) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized access" });
    }

    req.user = session.user;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Middleware factory to enforce required roles
 */
export const requireRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized access" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message:
          "Forbidden: You do not have permission to access this resource",
      });
    }

    next();
  };
};
