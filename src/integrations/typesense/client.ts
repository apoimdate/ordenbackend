import Typesense from 'typesense';
import type { Client } from 'typesense';
import { logger } from '../../utils/logger';

export class TypesenseClient {
  private static instance: TypesenseClient;
  private client: Client;

  private constructor() {
    this.client = new Typesense.Client({
      nodes: [
        {
          host: process.env.TYPESENSE_HOST || 'localhost',
          port: parseInt(process.env.TYPESENSE_PORT || '8108'),
          protocol: process.env.TYPESENSE_PROTOCOL || 'http'
        }
      ],
      apiKey: process.env.TYPESENSE_API_KEY || '',
      connectionTimeoutSeconds: 2,
      logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'error'
    });

    logger.info('Typesense client initialized');
  }

  static getInstance(): TypesenseClient {
    if (!TypesenseClient.instance) {
      TypesenseClient.instance = new TypesenseClient();
    }
    return TypesenseClient.instance;
  }

  getClient(): Client {
    return this.client;
  }

  async health(): Promise<boolean> {
    try {
      const health = await this.client.health.retrieve();
      return health.ok === true;
    } catch (_error) { logger.error({ error: _error }, 'Typesense health check failed');
      return false;
    }
  }

  async createCollection(schema: any): Promise<any> {
    try {
      return await this.client.collections().create(schema);
    } catch (error: any) {
      if (error.httpStatus === 409) {
        logger.warn(`Collection ${schema.name} already exists`);
        return await this.client.collections(schema.name).retrieve();
      }
      throw error;
    }
  }

  async deleteCollection(name: string): Promise<void> {
    try {
      await this.client.collections(name).delete();
      logger.info(`Collection ${name} deleted`);
    } catch (error: any) {
      if (error.httpStatus !== 404) {
        throw error;
      }
    }
  }

  async upsertDocument(
    collectionName: string,
    document: any
  ): Promise<any> {
    try {
      return await this.client
        .collections(collectionName)
        .documents()
        .upsert(document);
    } catch (_error) { logger.error({ error: _error, collectionName }, 'Failed to upsert document');
      throw _error;
    }
  }

  async upsertDocuments(
    collectionName: string,
    documents: any[]
  ): Promise<any> {
    try {
      return await this.client
        .collections(collectionName)
        .documents()
        .import(documents, { action: 'upsert' });
    } catch (_error) { logger.error({ error: _error, collectionName }, 'Failed to upsert documents');
      throw _error;
    }
  }

  async deleteDocument(
    collectionName: string,
    documentId: string
  ): Promise<void> {
    try {
      await this.client
        .collections(collectionName)
        .documents(documentId)
        .delete();
    } catch (_error) { logger.error({ error: _error, collectionName, documentId }, 'Failed to delete document');
      throw _error;
    }
  }

  async search(
    collectionName: string,
    searchParams: any
  ): Promise<any> {
    try {
      return await this.client
        .collections(collectionName)
        .documents()
        .search(searchParams);
    } catch (_error) { logger.error({ error: _error, collectionName }, 'Search failed');
      throw _error;
    }
  }

  async multiSearch(searches: any[]): Promise<any> {
    try {
      return await this.client.multiSearch.perform({
        searches
      });
    } catch (_error) { logger.error({ error: _error }, 'Multi-search failed');
      throw _error;
    }
  }

  async getDocument(
    collectionName: string,
    documentId: string
  ): Promise<any> {
    try {
      return await this.client
        .collections(collectionName)
        .documents(documentId)
        .retrieve();
    } catch (_error) { logger.error({ error: _error, collectionName, documentId }, 'Failed to get document');
      throw _error;
    }
  }

  async getCollectionInfo(collectionName: string): Promise<any> {
    try {
      return await this.client.collections(collectionName).retrieve();
    } catch (_error) { logger.error({ error: _error, collectionName }, 'Failed to get collection info');
      throw _error;
    }
  }

  async listCollections(): Promise<any[]> {
    try {
      return await this.client.collections().retrieve();
    } catch (_error) { logger.error({ error: _error }, 'Failed to list collections');
      throw _error;
    }
  }
}
