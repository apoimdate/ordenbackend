import { PrismaClient } from '@prisma/client';

export abstract class SimpleBaseRepository<
  T,
  CreateInput,
  UpdateInput,
  WhereUniqueInput,
  WhereInput,
  OrderByInput,
  IncludeInput
> {
  protected prisma: PrismaClient;
  protected modelName: string;

  constructor(prisma: PrismaClient, modelName: string) {
    this.prisma = prisma;
    this.modelName = modelName;
  }

  async findById(id: string): Promise<T | null> {
    return (this.prisma as any)[this.modelName].findUnique({
      where: { id }
    });
  }

  async findMany(args?: {
    where?: WhereInput;
    orderBy?: OrderByInput;
    skip?: number;
    take?: number;
    include?: IncludeInput;
  }): Promise<T[]> {
    return (this.prisma as any)[this.modelName].findMany(args);
  }

  async create(data: CreateInput): Promise<T> {
    return (this.prisma as any)[this.modelName].create({
      data
    });
  }

  async update(id: string, data: UpdateInput): Promise<T> {
    return (this.prisma as any)[this.modelName].update({
      where: { id },
      data
    });
  }

  async delete(id: string): Promise<T> {
    return (this.prisma as any)[this.modelName].delete({
      where: { id }
    });
  }

  async count(where?: WhereInput): Promise<number> {
    return (this.prisma as any)[this.modelName].count({
      where
    });
  }

  async upsert(args: {
    where: WhereUniqueInput;
    update: UpdateInput;
    create: CreateInput;
  }): Promise<T> {
    return (this.prisma as any)[this.modelName].upsert(args);
  }

  async aggregate(args: any): Promise<any> {
    return (this.prisma as any)[this.modelName].aggregate(args);
  }
}
