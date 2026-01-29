import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Testing Prisma connection...");
    const postCount = await prisma.blogPost.count();
    console.log(`Prisma connection successful. Total blog posts: ${postCount}`);
  } catch (error) {
    console.error("Prisma connection failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
