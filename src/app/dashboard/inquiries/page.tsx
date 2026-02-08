import { prisma, withRetry } from "@lib/prisma";
import InquiriesTable from "@components/InquiriesTable";
import TourInquiryCards from "@components/TourInquiryCards";
import ErrorState from "@components/ErrorState";
import { supabaseAdmin } from "@lib/supabase";

export const dynamic = "force-dynamic";

export default async function InquiriesPage() {
  let inquiries: any[] = [];
  let fetchError: any = null;

  try {
    console.log("Fetching inquiries via Prisma...");
    const start = Date.now();
    
    // Use withRetry to handle transient connection issues
    // Add a local timeout for the Prisma operation to prevent RSC hanging during HMR or slow DB
    const prismaPromise = withRetry(() => prisma.inquiry.findMany({
      where: {
        NOT: {
          type: "AI Lead"
        }
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        createdAt: true,
        name: true,
        email: true,
        phone: true,
        subject: true,
        message: true,
        status: true,
        recipientEmail: true,
        type: true,
        tourDate: true,
        tourTime: true,
        transcript: true,
        listing: {
          select: {
            title: true,
            slug: true,
            address: true,
            city: true,
            state: true
          }
        }
      }
    }), 2, 500);

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Prisma timeout")), 5000)
    );

    inquiries = await Promise.race([prismaPromise, timeoutPromise]) as any[];
    console.log(`Prisma fetch successful in ${Date.now() - start}ms`);
  } catch (error: any) {
    console.warn(`Prisma failed or timed out: ${error.message}, attempting Supabase fallback...`);
    
    // Supabase Fallback
    try {
      console.log("Fetching inquiries via Supabase fallback...");
      const start = Date.now();
      const { data, error: sbError } = await supabaseAdmin
        .from('Inquiry')
        .select('*, listing:Listing(title, slug, address, city, state)')
        .neq('type', 'AI Lead')
        .order('createdAt', { ascending: false })
        .limit(50);
      
      if (sbError) throw sbError;
      inquiries = data || [];
      console.log(`Supabase fetch successful in ${Date.now() - start}ms`);
    } catch (fallbackError) {
      console.error("Both Prisma and Supabase failed to fetch inquiries:", fallbackError);
      fetchError = fallbackError;
    }
  }

  if (fetchError && inquiries.length === 0) {
    return <ErrorState title="Failed to load inquiries" />;
  }

  // Filter inquiries by subject or type
  const tourInquiries = inquiries.filter(i => 
    i.type === "Tour" || 
    i.subject === "Tour/Site Viewing" || 
    (i.subject && i.subject.toLowerCase().includes("tour request"))
  );
  
  const generalInquiries = inquiries.filter(i => 
    i.type !== "Tour" && 
    i.subject !== "Tour/Site Viewing" && 
    !(i.subject && i.subject.toLowerCase().includes("tour request"))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inquiries Dashboard</h1>
          <p className="text-sm text-slate-500">Manage tour requests and mail inquiries</p>
        </div>
        <div className="flex gap-2">
          <div className="text-sm font-medium bg-sky-50 px-3 py-1 rounded-full text-sky-700">
            Tours: {tourInquiries.length}
          </div>
          <div className="text-sm font-medium bg-slate-100 px-3 py-1 rounded-full text-slate-600">
            General: {generalInquiries.length}
          </div>
        </div>
      </div>

      <TourInquiryCards inquiries={tourInquiries} />

      <div className="flex flex-col">
        <h2 className="text-xl font-bold text-slate-800">General Inquiries</h2>
        <p className="text-sm text-slate-500">Manage all received mail inquiries</p>
      </div>
      <InquiriesTable inquiries={generalInquiries} type="general" />
    </div>
  );
}
