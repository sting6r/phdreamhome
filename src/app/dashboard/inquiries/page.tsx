import { prisma, withRetry } from "@lib/prisma";
import InquiriesTable from "@components/InquiriesTable";
import ErrorState from "@components/ErrorState";
import { supabaseAdmin } from "@lib/supabase";

export const dynamic = "force-dynamic";

export default async function InquiriesPage() {
  let inquiries: any[] = [];
  let fetchError: any = null;

  try {
    console.log("Fetching inquiries via Prisma...");
    const start = Date.now();
    
    // Add a local timeout for the Prisma operation to prevent RSC hanging
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
        listing: {
          select: {
            title: true,
            slug: true
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
        .select('*, listing:Listing(title, slug)')
        .not('type', 'eq', 'AI Lead')
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">General Inquiries</h1>
          <p className="text-sm text-slate-500">Manage tour requests and mail inquiries</p>
        </div>
        <div className="text-sm font-medium bg-slate-100 px-3 py-1 rounded-full text-slate-600">
          Total: {inquiries.length}
        </div>
      </div>

      <InquiriesTable inquiries={inquiries} type="general" />
    </div>
  );
}
