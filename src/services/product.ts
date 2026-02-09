import { prismaExtend } from "./prismaClient";
import { PrismaClient } from "../generated/prisma";
const prisma = new PrismaClient();
export type ProductArgs = {
  title: string;
  content: string;
  body: string;
  image: string;
  authorId: number;
  category: string;
  type: string;
  tags: string[];
};

export const createOneProduct = async (data: any) => {
  const productdata: any = {
    name: data.name,
    description: data.description,
    price: data.price,
    discount: data.discount,
    inventory: data.inventory,
    category: {
      connectOrCreate: {
        where: { name: data.category },
        create: {
          name: data.category,
        },
      },
    },
    type: {
      connectOrCreate: {
        where: { name: data.type },
        create: {
          name: data.type,
        },
      },
    },
    images: {
      create: data.images,
    },
  };

  if (data.tags && data.tags.length > 0) {
    productdata.tags = {
      connectOrCreate: data.tags.map((tagName: string) => ({
        where: { name: tagName },
        create: {
          name: tagName,
        },
      })),
    };
  }
  return prismaExtend.product.create({ data: productdata });
};

export const getProductById = async (productId: number) => {
  return await prisma.product.findUnique({
    where: { id: productId },
    include: { images: true },
  });
};

export const updateOneProduct = async (productId: number, productData: any) => {
  const data: any = {
    name: productData.name,
    description: productData.description,
    price: productData.price,
    discount: productData.discount,
    inventory: productData.inventory,
    category: {
      set: [],
      connectOrCreate: {
        where: { name: productData.category },
        create: {
          name: productData.category,
        },
      },
    },
    type: {
      connectOrCreate: {
        where: { name: productData.type },
        create: {
          name: productData.type,
        },
      },
    },
  };

  if (productData.tags && productData.tags.length > 0) {
    data.tags = {
      set: [],
      connectOrCreate: productData.tags.map((tagName: string) => ({
        where: { name: tagName },
        create: {
          name: tagName,
        },
      })),
    };
  }

  if (data.images && data.images.length > 0) {
    data.images = {
      deleteMany: {},
      create: data.images,
    };
  }

  return prismaExtend.product.update({
    where: { id: productId },
    data,
  });
};

export const deleteOneProduct = async (id: number) => {
  return prismaExtend.product.delete({
    where: { id },
  });
};

export const getProductsWithRelations = async (productId: number) => {
  return await prismaExtend.product.findUnique({
    where: { id: productId },
    omit: {
      categoryId: true,
      typeId: true,
      createdAt: true,
      updatedAt: true,
    },
    include: {
      images: {
        select: {
          id: true,
          path: true,
        },
      },
    },
  });
};

export const getProductsList = async (options: any) => {
  return prisma.product.findMany(options);
};
