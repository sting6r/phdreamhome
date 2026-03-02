import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log("Usage: npx tsx scripts/update-location.ts <search_term> <latitude> <longitude>");
    console.log("Example: npx tsx scripts/update-location.ts \"Taft East\" 10.318 123.905");
    process.exit(1);
  }

  const searchTerm = args[0];
  const lat = parseFloat(args[1]);
  const lon = parseFloat(args[2]);

  if (isNaN(lat) || isNaN(lon)) {
    console.error("Invalid coordinates. Latitude and Longitude must be numbers.");
    process.exit(1);
  }

  console.log(`Searching for listing: "${searchTerm}"`);

  // Try to find by slug first
  let listing = await prisma.listing.findUnique({
    where: { slug: searchTerm }
  });

  // If not found, search by title
  if (!listing) {
    const listings = await prisma.listing.findMany({
      where: { 
        title: { contains: searchTerm, mode: "insensitive" }
      }
    });

    if (listings.length === 0) {
      console.error("No listing found matching that search term.");
      process.exit(1);
    }

    if (listings.length > 1) {
      console.warn(`Found ${listings.length} listings. Updating the first one:`);
      listings.forEach((l, i) => console.log(`  ${i + 1}. ${l.title} (${l.slug})`));
    }
    
    listing = listings[0];
  }

  console.log(`Updating: ${listing.title} (${listing.slug})`);
  console.log(`Current Location: ${listing.latitude ?? 'N/A'}, ${listing.longitude ?? 'N/A'}`);
  console.log(`New Location: ${lat}, ${lon}`);

  const updated = await prisma.listing.update({
    where: { id: listing.id },
    data: {
      latitude: lat,
      longitude: lon
    }
  });

  console.log("✅ Successfully updated coordinates.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
