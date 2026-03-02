import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const slug = "taft-east-condo-studio-unit-rent-mm0zalck";
  
  console.log(`Updating coordinates for listing: ${slug}`);

  // Find the listing
  const listing = await prisma.listing.findUnique({
    where: { slug }
  });

  if (!listing) {
    console.error("Listing not found!");
    process.exit(1);
  }

  console.log(`Found listing: ${listing.title} (${listing.id})`);

  // Update coordinates
  // Taft East Gate coordinates: 10.3182, 123.9048
  const updated = await prisma.listing.update({
    where: { id: listing.id },
    data: {
      latitude: 10.3182,
      longitude: 123.9048
    }
  });

  console.log("Coordinates updated:", updated.latitude, updated.longitude);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
