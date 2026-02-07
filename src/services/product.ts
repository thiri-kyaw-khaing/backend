import { prisma } from "./prismaClient";
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

export const createOneProduct = async (productData: ProductArgs) => {
  const data: any = {
    title: productData.title,
    content: productData.content,
    body: productData.body,
    image: productData.image,
    author: { connect: { id: productData.authorId } },
    category: {
      connectOrCreate: {
        where: { name: productData.category },
        create: { name: productData.category },
      },
    },
    type: {
      connectOrCreate: {
        where: { name: productData.type },
        create: { name: productData.type },
      },
    },
  };
  if (productData.tags && productData.tags.length > 0) {
    data.tags = {
      connectOrCreate: productData.tags.map((tagName) => ({
        where: { name: tagName },
        create: {
          name: tagName,
        },
      })),
    };
  }

  return await prisma.product.create({
    data: data,
  });
};
