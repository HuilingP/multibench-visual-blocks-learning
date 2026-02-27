import { PaperCandidatesAdmin } from "@/components/PaperCandidatesAdmin";
import { AdminHeader } from "@/components/PageHeaders";
import { TopNav } from "@/components/TopNav";

export default function AdminPage() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-[1400px] px-6 py-8">
        <div className="flex items-end justify-between gap-6">
          <AdminHeader />
          <TopNav mode="admin" />
        </div>

        <div className="mt-6">
          <PaperCandidatesAdmin />
        </div>
      </div>
    </main>
  );
}

