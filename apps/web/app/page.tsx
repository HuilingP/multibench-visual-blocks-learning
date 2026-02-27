import { PipelineCanvas } from "@/components/PipelineCanvas";
import { RunHistory } from "@/components/RunHistory";
import { BuilderHeader } from "@/components/PageHeaders";
import { TopNav } from "@/components/TopNav";

export default function Page() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-[1400px] px-6 py-8">
        <div className="flex items-start justify-between gap-6">
          <BuilderHeader />
          <TopNav mode="builder" />
        </div>

        <div className="mt-6">
          <PipelineCanvas />
        </div>

        <div className="mt-6">
          <RunHistory />
        </div>
      </div>
    </main>
  );
}

