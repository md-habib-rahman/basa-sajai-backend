import { prisma } from "../../config/db.js";

export const getAllUsers = async () => {
  return await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
};

export const updateUserStatusAndRole = async (userId, { role, isActive }) => {
  return await prisma.user.update({
    where: { id: userId },
    data: {
      ...(role && { role }),
      ...(isActive !== undefined && { isActive: Boolean(isActive) }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
    },
  });
};