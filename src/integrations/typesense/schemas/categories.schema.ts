import { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

export const categoriesSchema: CollectionCreateSchema = {
  name: 'categories',
  fields: [
    { name: 'id', type: 'string', facet: false },
    { name: 'name', type: 'string', facet: false, infix: true },
    { name: 'description', type: 'string', facet: false, optional: true },
    { name: 'slug', type: 'string', facet: false },
    { name: 'parentId', type: 'string', facet: true, optional: true },
    { name: 'path', type: 'string[]', facet: true }, // Full category path
    { name: 'level', type: 'int32', facet: true }, // Depth level
    { name: 'productCount', type: 'int32', facet: false },
    { name: 'isActive', type: 'bool', facet: true },
    { name: 'isFeatured', type: 'bool', facet: true },
    { name: 'order', type: 'int32', facet: false },
    { name: 'image', type: 'string', facet: false, optional: true },
    { name: 'icon', type: 'string', facet: false, optional: true }
  ],
  default_sorting_field: 'order'
};