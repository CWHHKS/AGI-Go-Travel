const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const places = await prisma.place.findMany({
    where: {
      name: {
        contains: '한강시장',
        mode: 'insensitive'
      }
    },
    include: {
      trip: true
    }
  });

  const exactMatches = await prisma.place.findMany({
    where: {
      name: {
        contains: '한강 시장',
        mode: 'insensitive'
      }
    },
    include: {
      trip: true
    }
  });

  console.log('Search Result (한강시장):', JSON.stringify(places, null, 2));
  console.log('Search Result (한강 시장):', JSON.stringify(exactMatches, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
