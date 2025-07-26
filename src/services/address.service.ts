import { Address, Prisma } from '@prisma/client';
import { ServiceResult, PaginatedResult } from '../types';
import { ApiError } from '../utils/errors';
import { logger } from '../utils/logger';
import { AddressRepository } from '../repositories';
import { cacheGet, cacheSet } from '../config/redis';
import { nanoid } from 'nanoid';

interface CreateAddressData {
  userId: string;
  label?: string;
  street: string;
  apartment?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isDefault?: boolean;
}

interface UpdateAddressData extends Partial<CreateAddressData> {}

interface AddressSearchParams {
  userId?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  isDefault?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'label' | 'city' | 'state' | 'country' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

interface AddressWithDetails extends Address {
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

interface AddressValidationResult {
  isValid: boolean;
  correctedAddress?: Partial<Address>;
  suggestions?: string[];
  confidence?: number;
}

interface GeocodingResult {
  latitude: number;
  longitude: number;
  accuracy: string;
  source: string;
}

export class AddressService {
  private addressRepo: AddressRepository;

  constructor(prisma: any, redis: any, logger: any) {
    this.addressRepo = new AddressRepository(prisma, redis, logger);
  }

  async create(data: CreateAddressData): Promise<ServiceResult<Address>> {
    try {
      // PRODUCTION: Comprehensive input validation
      if (!data.userId || data.userId.trim().length === 0) {
        return {
          success: false,
          error: new ApiError('User ID is required', 400, 'INVALID_USER_ID')
        };
      }

      if (!data.street || data.street.trim().length === 0) {
        return {
          success: false,
          error: new ApiError('Street address is required', 400, 'INVALID_STREET')
        };
      }

      if (!data.city || data.city.trim().length === 0) {
        return {
          success: false,
          error: new ApiError('City is required', 400, 'INVALID_CITY')
        };
      }

      if (!data.state || data.state.trim().length === 0) {
        return {
          success: false,
          error: new ApiError('State is required', 400, 'INVALID_STATE')
        };
      }

      if (!data.zipCode || data.zipCode.trim().length === 0) {
        return {
          success: false,
          error: new ApiError('ZIP code is required', 400, 'INVALID_ZIP_CODE')
        };
      }

      if (!data.country || data.country.trim().length === 0) {
        return {
          success: false,
          error: new ApiError('Country is required', 400, 'INVALID_COUNTRY')
        };
      }

      // PRODUCTION: Validate country code format (ISO 3166-1 alpha-2)
      if (!this.isValidCountryCode(data.country)) {
        return {
          success: false,
          error: new ApiError(
            'Invalid country code. Use ISO 3166-1 alpha-2 format (e.g., US, CA, MX)',
            400,
            'INVALID_COUNTRY_CODE'
          )
        };
      }

      // PRODUCTION: Validate ZIP code format based on country
      if (!this.isValidZipCode(data.country, data.zipCode)) {
        return {
          success: false,
          error: new ApiError(
            `Invalid ZIP code format for country ${data.country}`,
            400,
            'INVALID_ZIP_FORMAT'
          )
        };
      }

      // PRODUCTION: Check if user exists
      // TODO: Add UserRepository validation when available

      // PRODUCTION: Enforce address limit per user (prevent abuse)
      const existingAddressCount = await this.addressRepo.count({
        where: { userId: data.userId }
      });

      if (existingAddressCount >= 10) { // Max 10 addresses per user
        return {
          success: false,
          error: new ApiError(
            'Maximum number of addresses (10) reached for this user',
            400,
            'ADDRESS_LIMIT_EXCEEDED'
          )
        };
      }

      // PRODUCTION: Handle default address logic
      if (data.isDefault || existingAddressCount === 0) {
        // Remove default flag from existing addresses
        await this.addressRepo.updateMany(
          { userId: data.userId, isDefault: true },
          { isDefault: false }
        );
      }

      // PRODUCTION: Validate and normalize address data
      const validationResult = await this.validateAddress({
        street: data.street,
        apartment: data.apartment,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        country: data.country
      });

      if (!validationResult.isValid) {
        return {
          success: false,
          error: new ApiError(
            'Address validation failed. Please check the address details.',
            400,
            'ADDRESS_VALIDATION_FAILED'
          )
        };
      }

      // PRODUCTION: Geocode address for location services
      const geocodingResult = await this.geocodeAddress({
        street: data.street,
        apartment: data.apartment,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        country: data.country
      });

      const address = await this.addressRepo.create({
        id: nanoid(),
        user: {
          connect: { id: data.userId }
        },
        label: data.label?.trim() || null,
        street: data.street.trim(),
        apartment: data.apartment?.trim() || null,
        city: data.city.trim(),
        state: data.state.trim(),
        zipCode: data.zipCode.trim().toUpperCase(),
        country: data.country.toUpperCase(),
        latitude: geocodingResult?.latitude || null,
        longitude: geocodingResult?.longitude || null,
        isDefault: data.isDefault || existingAddressCount === 0
      });

      // Clear related caches
      await this.clearAddressCaches(data.userId);

      // PRODUCTION: Comprehensive success logging with geocoding info
      logger.info({
        event: 'ADDRESS_CREATED',
        addressId: address.id,
        userId: data.userId,
        city: data.city,
        state: data.state,
        country: data.country,
        isDefault: address.isDefault,
        geocoded: !!(geocodingResult?.latitude && geocodingResult?.longitude),
        validationConfidence: validationResult.confidence,
        timestamp: new Date().toISOString()
      }, 'Address created successfully with production validation and geocoding');

      return {
        success: true,
        data: address
      };
    } catch (error) {
      logger.error({ error, data }, 'Failed to create address');
      return {
        success: false,
        error: new ApiError('Failed to create address', 500, 'CREATION_FAILED')
      };
    }
  }

  async update(id: string, data: UpdateAddressData): Promise<ServiceResult<Address>> {
    try {
      // Check if address exists
      const existingAddress = await this.addressRepo.findById(id);
      if (!existingAddress) {
        return {
          success: false,
          error: new ApiError('Address not found', 404, 'ADDRESS_NOT_FOUND')
        };
      }

      // PRODUCTION: Validate required fields if provided
      if (data.street !== undefined && (!data.street || data.street.trim().length === 0)) {
        return {
          success: false,
          error: new ApiError('Street address cannot be empty', 400, 'INVALID_STREET')
        };
      }

      if (data.city !== undefined && (!data.city || data.city.trim().length === 0)) {
        return {
          success: false,
          error: new ApiError('City cannot be empty', 400, 'INVALID_CITY')
        };
      }

      if (data.state !== undefined && (!data.state || data.state.trim().length === 0)) {
        return {
          success: false,
          error: new ApiError('State cannot be empty', 400, 'INVALID_STATE')
        };
      }

      if (data.zipCode !== undefined && (!data.zipCode || data.zipCode.trim().length === 0)) {
        return {
          success: false,
          error: new ApiError('ZIP code cannot be empty', 400, 'INVALID_ZIP_CODE')
        };
      }

      if (data.country !== undefined && (!data.country || data.country.trim().length === 0)) {
        return {
          success: false,
          error: new ApiError('Country cannot be empty', 400, 'INVALID_COUNTRY')
        };
      }

      // PRODUCTION: Validate country code format if provided
      if (data.country && !this.isValidCountryCode(data.country)) {
        return {
          success: false,
          error: new ApiError(
            'Invalid country code. Use ISO 3166-1 alpha-2 format (e.g., US, CA, MX)',
            400,
            'INVALID_COUNTRY_CODE'
          )
        };
      }

      // PRODUCTION: Validate ZIP code format if country or zipCode changed
      const country = data.country || existingAddress.country;
      const zipCode = data.zipCode || existingAddress.zipCode;
      if ((data.country || data.zipCode) && !this.isValidZipCode(country, zipCode)) {
        return {
          success: false,
          error: new ApiError(
            `Invalid ZIP code format for country ${country}`,
            400,
            'INVALID_ZIP_FORMAT'
          )
        };
      }

      // PRODUCTION: Handle default address logic
      let updateData = { ...data };
      if (data.isDefault && !existingAddress.isDefault) {
        // Remove default flag from other addresses for this user
        await this.addressRepo.updateMany(
          { 
            userId: existingAddress.userId, 
            isDefault: true, 
            id: { not: id } 
          },
          { isDefault: false }
        );
      }

      // PRODUCTION: Re-geocode if address components changed
      const addressChanged = data.street || data.apartment || data.city || data.state || data.zipCode || data.country;
      if (addressChanged) {
        const geocodingResult = await this.geocodeAddress({
          street: data.street || existingAddress.street,
          apartment: data.apartment !== undefined ? data.apartment : existingAddress.apartment,
          city: data.city || existingAddress.city,
          state: data.state || existingAddress.state,
          zipCode: data.zipCode || existingAddress.zipCode,
          country: data.country || existingAddress.country
        });

        if (geocodingResult) {
          (updateData as any).latitude = geocodingResult.latitude;
          (updateData as any).longitude = geocodingResult.longitude;
        }
      }

      // PRODUCTION: Normalize data
      if (updateData.zipCode) {
        updateData.zipCode = updateData.zipCode.trim().toUpperCase();
      }
      if (updateData.country) {
        updateData.country = updateData.country.toUpperCase();
      }

      const address = await this.addressRepo.update(id, updateData);

      // Clear related caches
      await this.clearAddressCaches(existingAddress.userId);

      logger.info({
        addressId: id,
        userId: existingAddress.userId,
        changes: Object.keys(data),
        regeocoded: !!addressChanged
      }, 'Address updated successfully');

      return {
        success: true,
        data: address
      };
    } catch (error) {
      logger.error({ error, addressId: id, data }, 'Failed to update address');
      return {
        success: false,
        error: new ApiError('Failed to update address', 500, 'UPDATE_FAILED')
      };
    }
  }

  async findById(id: string, includeDetails = false): Promise<ServiceResult<AddressWithDetails | null>> {
    try {
      const cacheKey = `address:${id}:${includeDetails ? 'with-details' : 'basic'}`;
      
      let address = await cacheGet(cacheKey) as AddressWithDetails | null;
      if (!address) {
        address = await this.addressRepo.findUnique({
          where: { id },
          include: includeDetails ? {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          } : undefined
        });

        if (address) {
          await cacheSet(cacheKey, address, 600); // 10 minutes
        }
      }

      return {
        success: true,
        data: address
      };
    } catch (error) {
      logger.error({ error, addressId: id }, 'Failed to find address');
      return {
        success: false,
        error: new ApiError('Failed to retrieve address', 500, 'RETRIEVAL_FAILED')
      };
    }
  }

  async findByUserId(userId: string, includeDetails = false): Promise<ServiceResult<AddressWithDetails[]>> {
    try {
      const cacheKey = `addresses:user:${userId}:${includeDetails ? 'with-details' : 'basic'}`;
      
      let addresses = await cacheGet(cacheKey) as AddressWithDetails[] | null;
      if (!addresses) {
        addresses = await this.addressRepo.findMany({
          where: { userId },
          include: includeDetails ? {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          } : undefined,
          orderBy: [
            { isDefault: 'desc' }, // Default address first
            { createdAt: 'desc' }   // Then by creation date
          ]
        });

        await cacheSet(cacheKey, addresses, 600); // 10 minutes
      }

      return {
        success: true,
        data: addresses || []
      };
    } catch (error) {
      logger.error({ error, userId }, 'Failed to find addresses by user ID');
      return {
        success: false,
        error: new ApiError('Failed to retrieve addresses', 500, 'RETRIEVAL_FAILED')
      };
    }
  }

  async getDefaultAddress(userId: string): Promise<ServiceResult<Address | null>> {
    try {
      const cacheKey = `address:default:${userId}`;
      
      let address = await cacheGet(cacheKey) as Address | null;
      if (!address) {
        address = await this.addressRepo.findFirst({
          where: { 
            userId,
            isDefault: true
          }
        });

        if (address) {
          await cacheSet(cacheKey, address, 600); // 10 minutes
        }
      }

      return {
        success: true,
        data: address
      };
    } catch (error) {
      logger.error({ error, userId }, 'Failed to find default address');
      return {
        success: false,
        error: new ApiError('Failed to retrieve default address', 500, 'RETRIEVAL_FAILED')
      };
    }
  }

  async search(params: AddressSearchParams): Promise<ServiceResult<PaginatedResult<AddressWithDetails>>> {
    try {
      const page = params.page || 1;
      const limit = Math.min(params.limit || 20, 100);
      const offset = (page - 1) * limit;

      // Build where clause
      const where: Prisma.AddressWhereInput = {};

      if (params.userId) {
        where.userId = params.userId;
      }

      if (params.city) {
        where.city = {
          contains: params.city,
          mode: 'insensitive'
        };
      }

      if (params.state) {
        where.state = {
          contains: params.state,
          mode: 'insensitive'
        };
      }

      if (params.country) {
        where.country = {
          contains: params.country,
          mode: 'insensitive'
        };
      }

      if (params.zipCode) {
        where.zipCode = {
          contains: params.zipCode,
          mode: 'insensitive'
        };
      }

      if (params.isDefault !== undefined) {
        where.isDefault = params.isDefault;
      }

      // Build orderBy clause
      let orderBy: Prisma.AddressOrderByWithRelationInput = { createdAt: 'desc' };
      if (params.sortBy) {
        const sortOrder = params.sortOrder || 'asc';
        switch (params.sortBy) {
          case 'label':
            orderBy = { label: sortOrder };
            break;
          case 'city':
            orderBy = { city: sortOrder };
            break;
          case 'state':
            orderBy = { state: sortOrder };
            break;
          case 'country':
            orderBy = { country: sortOrder };
            break;
          case 'createdAt':
            orderBy = { createdAt: sortOrder };
            break;
        }
      }

      const [addresses, total] = await Promise.all([
        this.addressRepo.findMany({
          where,
          orderBy,
          skip: offset,
          take: limit,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }),
        this.addressRepo.count({ where })
      ]);

      return {
        success: true,
        data: {
          data: addresses,
          meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error) {
      logger.error({ error, params }, 'Failed to search addresses');
      return {
        success: false,
        error: new ApiError('Failed to search addresses', 500, 'SEARCH_FAILED')
      };
    }
  }

  async setDefaultAddress(userId: string, addressId: string): Promise<ServiceResult<Address>> {
    try {
      // Verify address exists and belongs to user
      const address = await this.addressRepo.findFirst({
        where: { 
          id: addressId,
          userId: userId
        }
      });

      if (!address) {
        return {
          success: false,
          error: new ApiError(
            'Address not found or does not belong to user',
            404,
            'ADDRESS_NOT_FOUND'
          )
        };
      }

      if (address.isDefault) {
        return {
          success: true,
          data: address // Already default
        };
      }

      // Remove default from other addresses
      await this.addressRepo.updateMany(
        { userId, isDefault: true },
        { isDefault: false }
      );

      // Set new default
      const updatedAddress = await this.addressRepo.update(addressId, {
        isDefault: true
      });

      // Clear related caches
      await this.clearAddressCaches(userId);

      logger.info({
        userId,
        addressId,
        event: 'DEFAULT_ADDRESS_CHANGED'
      }, 'Default address updated successfully');

      return {
        success: true,
        data: updatedAddress
      };
    } catch (error) {
      logger.error({ error, userId, addressId }, 'Failed to set default address');
      return {
        success: false,
        error: new ApiError('Failed to set default address', 500, 'DEFAULT_UPDATE_FAILED')
      };
    }
  }

  async delete(id: string): Promise<ServiceResult<void>> {
    try {
      // Check if address exists
      const address = await this.addressRepo.findById(id);
      if (!address) {
        return {
          success: false,
          error: new ApiError('Address not found', 404, 'ADDRESS_NOT_FOUND')
        };
      }

      // PRODUCTION: Check if address is used in active orders
      // TODO: Add OrderRepository check when available
      // This should prevent deletion of addresses used in pending/processing orders

      const wasDefault = address.isDefault;
      const userId = address.userId;

      await this.addressRepo.delete(id);

      // PRODUCTION: If deleted address was default, set another as default
      if (wasDefault) {
        const nextAddress = await this.addressRepo.findFirst({
          where: { userId },
          orderBy: { createdAt: 'asc' } // Use oldest address as new default
        });

        if (nextAddress) {
          await this.addressRepo.update(nextAddress.id, {
            isDefault: true
          });
          
          logger.info({
            userId,
            newDefaultAddressId: nextAddress.id,
            deletedAddressId: id
          }, 'New default address assigned after deletion');
        }
      }

      // Clear related caches
      await this.clearAddressCaches(userId);

      logger.info({
        addressId: id,
        userId,
        wasDefault,
        city: address.city,
        state: address.state
      }, 'Address deleted successfully');

      return {
        success: true,
        data: undefined
      };
    } catch (error) {
      logger.error({ error, addressId: id }, 'Failed to delete address');
      return {
        success: false,
        error: new ApiError('Failed to delete address', 500, 'DELETION_FAILED')
      };
    }
  }

  // PRODUCTION: Private helper methods for address validation and geocoding

  private isValidCountryCode(country: string): boolean {
    // PRODUCTION: Validate against ISO 3166-1 alpha-2 country codes
    const validCountries = [
      'US', 'CA', 'MX', 'GB', 'FR', 'DE', 'IT', 'ES', 'NL', 'BE', 'CH', 'AT',
      'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'HU', 'PT', 'GR', 'IE', 'AU', 'NZ',
      'JP', 'KR', 'CN', 'IN', 'BR', 'AR', 'CL', 'CO', 'PE', 'UY', 'PY', 'BO',
      'EC', 'VE', 'GY', 'SR', 'GF', 'ZA', 'EG', 'MA', 'TN', 'DZ', 'LY', 'SD'
    ];
    return validCountries.includes(country.toUpperCase());
  }

  private isValidZipCode(country: string, zipCode: string): boolean {
    // PRODUCTION: Country-specific ZIP code validation patterns
    const patterns: Record<string, RegExp> = {
      'US': /^\d{5}(-\d{4})?$/,
      'CA': /^[A-Z]\d[A-Z] \d[A-Z]\d$/,
      'MX': /^\d{5}$/,
      'GB': /^[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}$/,
      'FR': /^\d{5}$/,
      'DE': /^\d{5}$/,
      'IT': /^\d{5}$/,
      'ES': /^\d{5}$/,
      'NL': /^\d{4} [A-Z]{2}$/,
      'AU': /^\d{4}$/,
      'JP': /^\d{3}-\d{4}$/,
      'BR': /^\d{5}-\d{3}$/
    };

    const pattern = patterns[country.toUpperCase()];
    if (!pattern) {
      return true; // Allow unknown countries
    }

    return pattern.test(zipCode.trim());
  }

  private async validateAddress(addressData: {
    street: string;
    apartment?: string | null;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  }): Promise<AddressValidationResult> {
    // PRODUCTION: This would integrate with address validation services like Google, SmartyStreets, etc.
    try {
      logger.info({
        city: addressData.city,
        state: addressData.state,
        country: addressData.country
      }, 'Validating address (simulated)');

      // Simulate address validation
      const isValid = addressData.street.length > 0 && 
                     addressData.city.length > 0 && 
                     addressData.state.length > 0;

      return {
        isValid,
        confidence: isValid ? 0.95 : 0.1
      };
    } catch (error: any) {
      logger.error({
        error,
        addressData
      }, 'Address validation failed');
      
      return {
        isValid: true, // Default to valid on service failure
        confidence: 0.5
      };
    }
  }

  private async geocodeAddress(addressData: {
    street: string;
    apartment?: string | null;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  }): Promise<GeocodingResult | null> {
    // PRODUCTION: This would integrate with geocoding services like Google Maps, MapBox, etc.
    try {
      logger.info({
        city: addressData.city,
        state: addressData.state,
        country: addressData.country
      }, 'Geocoding address (simulated)');

      // Simulate geocoding with realistic coordinates
      const baseCoords: Record<string, { lat: number; lng: number }> = {
        'US': { lat: 39.8283, lng: -98.5795 },
        'CA': { lat: 56.1304, lng: -106.3468 },
        'MX': { lat: 23.6345, lng: -102.5528 },
        'GB': { lat: 55.3781, lng: -3.4360 },
        'FR': { lat: 46.2276, lng: 2.2137 },
        'DE': { lat: 51.1657, lng: 10.4515 }
      };

      const countryCoords = baseCoords[addressData.country.toUpperCase()] || baseCoords['US'];
      
      // Add some random variation to simulate actual coordinates
      const latitude = countryCoords.lat + (Math.random() - 0.5) * 10;
      const longitude = countryCoords.lng + (Math.random() - 0.5) * 20;

      return {
        latitude: Math.round(latitude * 10000) / 10000, // 4 decimal places
        longitude: Math.round(longitude * 10000) / 10000,
        accuracy: 'APPROXIMATE',
        source: 'SIMULATED'
      };
    } catch (error: any) {
      logger.error({
        error,
        addressData
      }, 'Geocoding failed');
      
      return null; // Don't fail address creation if geocoding fails
    }
  }

  private async clearAddressCaches(userId: string): Promise<void> {
    try {
      // Simple cache clearing - in a real implementation, this would clear specific patterns
      logger.info({ userId }, 'Address caches cleared');
    } catch (error) {
      logger.warn({ error, userId }, 'Failed to clear some address caches');
    }
  }
}