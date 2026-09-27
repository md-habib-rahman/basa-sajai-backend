export const validateCreateProduct = (data) => {
  const errors = [];

  if (!data.title || typeof data.title !== "string" || !data.title.trim()) {
    errors.push("Product title is required.");
  }

  if (
    data.unitPrice === undefined ||
    isNaN(Number(data.unitPrice)) ||
    Number(data.unitPrice) < 0
  ) {
    errors.push("Valid manual unit cost (unitPrice) is required.");
  }

  if (
    data.stockQuantity !== undefined &&
    (isNaN(Number(data.stockQuantity)) || Number(data.stockQuantity) < 0)
  ) {
    errors.push("Stock quantity must be a valid non-negative number.");
  }

  if (
    data.actualSellingPrice !== null &&
    data.actualSellingPrice !== undefined &&
    (isNaN(Number(data.actualSellingPrice)) ||
      Number(data.actualSellingPrice) < 0)
  ) {
    errors.push("Actual selling price must be a valid non-negative number.");
  }

  return errors;
};

export const validatePatchProduct = (data) => {
  const errors = [];

  if (
    data.title !== undefined &&
    (typeof data.title !== "string" || !data.title.trim())
  ) {
    errors.push("Title cannot be empty if provided.");
  }

  if (
    data.unitPrice !== undefined &&
    (isNaN(Number(data.unitPrice)) || Number(data.unitPrice) < 0)
  ) {
    errors.push("Unit cost must be a valid non-negative number.");
  }

  if (
    data.stockQuantity !== undefined &&
    (isNaN(Number(data.stockQuantity)) || Number(data.stockQuantity) < 0)
  ) {
    errors.push("Stock quantity must be a valid non-negative number.");
  }

  return errors;
};
