import { prisma, withRetry } from "@lib/prisma";
import InquiriesTable from "@components/InquiriesTable";
import ErrorState from "@components/ErrorState";
import { supabaseAdmin } from "@lib/supabase";

export const dynamic = "force-dynamic";

export default async function AIInquiriesPage() {
  let inquiries: any[] = [];
  let fetchError: any = null;

  try {
    // Attempt Prisma fetch with retry
    inquiries = await withRetry(() => prisma.inquiry.findMany({
      where: {
        type: "AI Lead"
      },
      orderBy: { createdAt: "desc" },
      include: {
        listing: {
          select: {
            title: true,
            slug: true
          }
        }
      }
    }), 2, 500);
  } catch (error) {
    console.warn("Prisma failed to fetch AI inquiries, attempting Supabase fallback:", error);
    
    // Supabase Fallback
    try {
      const { data, error: sbError } = await supabaseAdmin
        .from('Inquiry')
        .select('*, listing:Listing(title, slug)')
        .eq('type', 'AI Lead')
        .order('createdAt', { ascending: false });
    
      if (sbError) throw sbError;
      inquiries = data || [];
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
