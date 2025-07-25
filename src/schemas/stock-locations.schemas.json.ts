export const findManyStockLocationSchema = {
  type: 'object',
  properties: {
    page: { type: 'string' },
    limit: { type: 'string' },
    search: { type: 'string' },
  },
};

export const findStockLocationByIdSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
  },
  required: ['id'],
};

export const createStockLocationSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    seller_id: { type: 'string' },
  },
  required: ['name', 'seller_id'],
};

export const updateStockLocationSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
  },
};

export const deleteStockLocationSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
  },
  required: ['id'],
};
