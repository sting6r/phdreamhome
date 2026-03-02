import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const searchTerm = "Casamira";
  
  console.log(`Searching for listing containing: ${searchTerm}`);

  // Find the listing
  const listings = await prisma.listing.findMany({
    where: { 
      title: { contains: searchTerm, mode: "insensitive" }
    }
  });

  if (listings.length === 0) {
    console.error("Listing not found!");
    // Try "Casa Mira" just in case
    const listings2 = await prisma.listing.findMany({
      where: { title: { contains: "Casa Mira", mode: "insensitive" } }
    });
    if (listings2.length === 0) {
        console.error("Listing not found with 'Casa Mira' either.");
        process.exit(1);
    }
    // Use the first one found
    updateListing(listings2[0]);
  } else {
    // Use the first one found
    updateListing(listings[0]);
  }
}

async function updateListing(listing: any) {
  console.log(`Found listing: ${listing.title} (${listing.slug})`);

  // Update coordinates
  // Casa Mira Towers Palawan: 9.7638, 118.7578
  const updated = await prisma.listing.update({
    where: { id: listing.id },
    data: {
      latitude: 9.7638,
      longitude: 118.7578
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
