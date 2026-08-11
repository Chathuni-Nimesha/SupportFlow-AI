import {
  ActivityTimeline,
  AiPerformanceOverview,
  AiSummaryCard,
  KpiCards,
  QuickActions,
  RecentConversationsTable,
  RecentTicketsTable,
  WelcomeHeader,
} from "@/components/dashboard/home"

export function DashboardHomePage() {
  return (
    <div className="space-y-6">
      <WelcomeHeader />
      <KpiCards />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <AiPerformanceOverview />
        <AiSummaryCard />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <RecentConversationsTable />
        <RecentTicketsTable />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <ActivityTimeline />
        <QuickActions />
      </div>
    </div>
  )
}
