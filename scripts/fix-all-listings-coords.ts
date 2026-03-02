import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function geocode(query: string) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "phdreamhome-fix-script/1.0"
      }
    });
    if (!res.ok) {
        console.error(`Geocode request failed: ${res.status} ${res.statusText}`);
        return null;
    }
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
  } catch (e) {
    console.error("Geocode error:", e);
  }
  return null;
}

async function main() {
  // Find listings with missing coordinates
  const listings = await prisma.listing.findMany({
    where: {
      OR: [
        { latitude: null },
        { longitude: null }
      ]
    }
  });

  console.log(`Found ${listings.length} listings to geocode.`);

  for (const l of listings) {
    const addressParts = [l.address, l.city, l.state, l.country].filter(Boolean);
    // Try full address
    let query = addressParts.join(", ").replace("Phililppines", "Philippines");
    console.log(`Processing: ${l.title}`);
    console.log(`  Query: ${query}`);

    let coords;
    
    // Override for Casamira (known location)
    if (l.title.includes("Casamira")) {
       coords = { lat: 9.7638, lon: 118.7578 };
       console.log("  Using hardcoded coordinates for Casamira.");
    } else {
       coords = await geocode(query);
    }
    
    // If failed, try less specific (City, State, Country)
    if (!coords && l.city && l.state) {
       const lessSpecific = [l.city, l.state, l.country].filter(Boolean).join(", ");
       console.log(`  Retrying with: ${lessSpecific}`);
       coords = await geocode(lessSpecific);
    }

    if (coords) {
      console.log(`  Found: ${coords.lat}, ${coords.lon}`);
      await prisma.listing.update({
        where: { id: l.id },
        data: { latitude: coords.lat, longitude: coords.lon }
      });
    } else {
      console.log("  Failed to geocode.");
    }

    // Wait 1.1 second to respect Nominatim rate limit (1 req/sec)
    await new Promise(r => setTimeout(r, 1100));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
