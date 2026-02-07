import { prisma, withRetry } from "@lib/prisma";
import InquiriesTable from "@components/InquiriesTable";

export const dynamic = "force-dynamic";

export default async function AIInquiriesPage() {
  try {
    const inquiries = await withRetry(() => prisma.inquiry.findMany({
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
    }));

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
  } catch (error) {
    console.error("Error fetching AI inquiries:", error);
    return (
      <div className="p-8 text-center border-2 border-dashed rounded-lg bg-slate-50">
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Failed to load AI leads</h2>
        <p className="text-slate-600 mb-4">
          There was a connection issue with the database. Please try refreshing the page.
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="btn-blue px-4 py-2 text-sm"
        >
          Refresh Page
        </button>
      </div>
    );
  }
}
