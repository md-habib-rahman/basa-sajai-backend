import * as userService from "./users.service.js";

export const getUsers = async (req, res, next) => {
  try {
    const users = await userService.getAllUsers();
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { role, isActive } = req.body;

    // Validate role if provided
    const validRoles = ["SUPER_ADMIN", "ADMIN", "MODERATOR"];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role specified" });
    }

    const updatedUser = await userService.updateUserStatusAndRole(userId, { role, isActive });
    res.json({ success: true, data: updatedUser });
  } catch (error) {
    next(error);
  }
};