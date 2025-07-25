import { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

// For tracking user search behavior and personalization
export const searchQueriesSchema: CollectionCreateSchema = {
  name: 'search_queries',
  fields: [
    { name: 'id', type: 'string', facet: false },
    { name: 'userId', type: 'string', facet: true },
    { name: 'sessionId', type: 'string', facet: true },
    { name: 'query', type: 'string', facet: false },
    { name: 'results', type: 'int32', facet: false },
    { name: 'clickedProductIds', type: 'string[]', facet: false, optional: true },
    { name: 'purchasedProductIds', type: 'string[]', facet: false, optional: true },
    { name: 'filters', type: 'object', facet: false, optional: true },
    { name: 'userAgent', type: 'string', facet: false, optional: true },
    { name: 'ipCountry', type: 'string', facet: true, optional: true },
    { name: 'timestamp', type: 'int64', facet: false }
  ],
  default_sorting_field: 'timestamp'
};