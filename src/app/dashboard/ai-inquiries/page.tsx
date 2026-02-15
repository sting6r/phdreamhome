import { prisma, withRetry } from "@lib/prisma";
import InquiriesTable from "@components/InquiriesTable";
import ErrorState from "@components/ErrorState";
import { supabaseAdmin } from "@lib/supabase";

export const dynamic = "force-dynamic";

export default async function AIInquiriesPage() {
  let inquiries: any[] = [];
  let fetchError: any = null;

  try {
    console.log("Fetching AI inquiries via Prisma...");
    const start = Date.now();
    
    // Add a local timeout for the Prisma operation to prevent RSC hanging
    const prismaPromise = withRetry(() => prisma.inquiry.findMany({
      where: {
        type: "AI Lead"
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
            slug: true
          }
        }
      }
    }), 2, 500);

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Prisma timeout")), 10000)
    );

    inquiries = await Promise.race([prismaPromise, timeoutPromise]) as any[];
    console.log(`Prisma AI fetch successful in ${Date.now() - start}ms`);
  } catch (error: any) {
    console.warn(`Prisma AI failed or timed out: ${error.message}, attempting Supabase fallback...`);
    
    // Supabase Fallback
    try {
      console.log("Fetching AI inquiries via Supabase fallback...");
      const start = Date.now();
      const { data, error: sbError } = await supabaseAdmin
        .from('Inquiry')
        .select('*, listing:Listing(title, slug)')
        .eq('type', 'AI Lead')
        .order('createdAt', { ascending: false })
        .limit(50);
    
      if (sbError) throw sbError;
      inquiries = data || [];
      console.log(`Supabase AI fetch successful in ${Date.now() - start}ms`);
    } catch (fallbackError) {
      console.error("Both Prisma and Supabase failed to fetch AI inquiries:", fallbackError);
      fetchError = fallbackError;
    }
  }

  if (fetchError && inquiries.length === 0) {
    return <ErrorState title="Failed to load AI leads" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Assistant Leads</h1>
          <p className="text-sm text-slate-500">Manage inquiries captured by Kyuubi AI</p>
        </div>
        <div className="text-sm font-medium bg-slate-100 px-3 py-1 rounded-full text-slate-600">
          Total: {inquiries.length}
        </div>
      </div>

      <InquiriesTable inquiries={inquiries} type="ai" />
    </div>
  );
}
