import { MetadataRoute } from 'next';
import { prisma } from "@lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.phdreamhome.com';

  // Fetch all published listings
  let listingUrls: any[] = [];
  try {
    const listings = await prisma.listing.findMany({
      where: { published: true },
      select: { id: true, slug: true, updatedAt: true }
    });

    listingUrls = listings.map((listing) => ({
      url: `${baseUrl}/listing/${listing.slug || listing.id}`,
      lastModified: listing.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
  } catch (error) {
    console.error("Sitemap generation failed to fetch listings:", error);
    // Return empty listings but continue with static routes
  }

  // Static routes
  const staticRoutes = [
    '',
    '/about',
    '/contact',
    '/properties/for-sale',
    '/properties/for-rent',
    '/properties/preselling',
    '/blog',
    '/privacy',
    '/terms',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 1.0,
  }));

  return [...staticRoutes, ...listingUrls];
}
