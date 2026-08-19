/**
 * Executes a paginated Prisma query and formats response metadata
 */
export const paginate = async (
  model,
  {
    page = 1,
    limit = 10,
    where = {},
    orderBy = { createdAt: "desc" },
    include = undefined,
  },
) => {
  const pageNum = Math.max(Number(page) || 1, 1);
  const limitNum = Math.max(Number(limit) || 10, 1);
  const skip = (pageNum - 1) * limitNum;

  const [totalItems, items] = await Promise.all([
    model.count({ where }),
    model.findMany({
      where,
      skip,
      take: limitNum,
      orderBy,
      include,
    }),
  ]);

  const totalPages = Math.ceil(totalItems / limitNum);

  return {
    items,
    meta: {
      totalItems,
      itemCount: items.length,
      itemsPerPage: limitNum,
      totalPages,
      currentPage: pageNum,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1,
    },
  };
};
