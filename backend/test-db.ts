import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const listings = await prisma.listing.findMany();
  console.log('Listings:', listings.length);
  listings.forEach(l => console.log(l.district));
}
main().catch(console.error).finally(() => prisma.$disconnect());
