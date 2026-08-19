export const validateCreateProduct = (data) => {
  const errors = [];
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    errors.push('Product name is required.');
  }
  if (data.baseUnitPrice === undefined || isNaN(Number(data.baseUnitPrice))) {
    errors.push('Valid base unit price is required.');
  }
  return errors;
};