const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.place.updateMany({
    where: { name: '한강 시장' },
    data: { name: '한강 시장 (Han Market), Da Nang, Vietnam' }
  });
  console.log(`Updated ${result.count} places.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
