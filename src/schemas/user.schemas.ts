import { z } from 'zod';

const commonPagination = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().optional().default(10),
});

const profileStats = z.object({
  totalOrders: z.number(),
  totalSpent: z.number(),
  totalReviews: z.number(),
  wishlistCount: z.number(),
  joinedDays: z.number(),
});

const address = z.object({
  id: z.string(),
  street: z.string(),
  city: z.string(),
  state: z.string(),
  country: z.string(),
  zipCode: z.string(),
  isDefault: z.boolean(),
});

const userProfile = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  phone: z.string().nullable(),
  avatar: z.string().url().nullable(),
  bio: z.string().nullable(),
  role: z.string(),
  isEmailVerified: z.boolean(),
  preferredCurrency: z.string().nullable(),
  createdAt: z.string(),
  addresses: z.array(address).optional(),
  stats: profileStats.optional(),
});

const getProfileSchema = z.object({
  querystring: z.object({
    includeStats: z.string().transform(val => val === 'true').optional(),
  }),
  response: z.object({
    '2xx': userProfile,
  }),
});

const updateProfileSchema = z.object({
  body: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
    avatar: z.string().url().optional(),
    bio: z.string().optional(),
  }),
  response: z.object({
    '2xx': userProfile,
  }),
});

const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string(),
    newPassword: z.string().min(8),
  }),
  response: z.object({
    '2xx': z.object({
      message: z.string(),
    }),
  }),
});

const addressSchema = z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    country: z.string().length(2),
    zipCode: z.string(),
    phone: z.string().optional(),
    isDefault: z.boolean().optional(),
    type: z.enum(['BILLING', 'SHIPPING', 'BOTH']).optional(),
    instructions: z.string().optional(),
});

const createAddressSchema = z.object({
  body: addressSchema,
  response: z.object({
    '2xx': address,
  }),
});

const updateAddressSchema = z.object({
  params: z.object({
    addressId: z.string(),
  }),
  body: addressSchema.partial(),
  response: z.object({
    '2xx': address,
  }),
});

const deleteAddressSchema = z.object({
    params: z.object({
        addressId: z.string(),
    }),
});

const getAddressesSchema = z.object({
    response: z.object({
        '2xx': z.array(address),
    })
});

const wishlistProduct = z.object({
    id: z.string(),
    name: z.string(),
    price: z.number(),
    currency: z.string(),
    images: z.array(z.string()).optional(),
    seller: z.object({
        storeName: z.string(),
    }).optional(),
});

const wishlistItem = z.object({
    id: z.string(),
    productId: z.string(),
    createdAt: z.string(),
    product: wishlistProduct,
});

const getWishlistSchema = z.object({
  querystring: commonPagination,
  response: z.object({
    '2xx': z.object({
      data: z.array(wishlistItem),
      meta: z.object({
        total: z.number(),
        page: z.number(),
        limit: z.number(),
        totalPages: z.number(),
      }),
    }),
  }),
});

const addToWishlistSchema = z.object({
  body: z.object({
    productId: z.string(),
  }),
  response: z.object({
    '2xx': z.object({
      message: z.string(),
    }),
  }),
});

const removeFromWishlistSchema = z.object({
  params: z.object({
    productId: z.string(),
  }),
});

const deleteAccountSchema = z.object({
    body: z.object({
        password: z.string(),
    }),
    response: z.object({
        '2xx': z.object({
            message: z.string(),
        }),
    })
});

const exportDataSchema = z.object({
    response: z.object({
        '2xx': z.object({
            exportId: z.string(),
            message: z.string(),
        }),
    })
});


export const userSchemas = {
  getProfile: getProfileSchema,
  updateProfile: updateProfileSchema,
  changePassword: changePasswordSchema,
  createAddress: createAddressSchema,
  updateAddress: updateAddressSchema,
  deleteAddress: deleteAddressSchema,
  getAddresses: getAddressesSchema,
  getWishlist: getWishlistSchema,
  addToWishlist: addToWishlistSchema,
  removeFromWishlist: removeFromWishlistSchema,
  deleteAccount: deleteAccountSchema,
  exportData: exportDataSchema,
};
