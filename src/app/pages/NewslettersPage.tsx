import { ArrowUpRight, ExternalLink, Newspaper } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

type NewsletterItem = {
  name: string;
  url: string;
  description: string;
  tag: string;
  accent: string;
  tint: string;
  icon: string;
};

const newsletters: NewsletterItem[] = [
  {
    name: "SD Times",
    url: "https://sdtimes.com/",
    description: "Technology and software development coverage for leaders, builders, and teams.",
    tag: "Software",
    accent: "#4169E1",
    tint: "#EEF3FF",
    icon: "SD",
  },
  {
    name: "StockTalk SA",
    url: "https://stocktalksa.co.za/",
    description: "South African market updates, stock insights, and investor commentary.",
    tag: "Markets",
    accent: "#0EA5E9",
    tint: "#E0F2FE",
    icon: "ST",
  },
  {
    name: "Cyber Security News in LinkedIn",
    url: "https://www.linkedin.com/search/results/content/?keywords=cyber%20security%20news",
    description: "A curated LinkedIn feed for the latest cybersecurity trends, breach analysis, and defensive tactics.",
    tag: "Security",
    accent: "#10B981",
    tint: "#ECFDF5",
    icon: "CS",
  },
  {
    name: "The Open Letter",
    url: "https://theopenletter.io/",
    description: "Thoughtful long-form writing on work, technology, and the broader economy.",
    tag: "Culture",
    accent: "#8B5CF6",
    tint: "#F3E8FF",
    icon: "OL",
  },
  {
    name: "The Print",
    url: "https://www.nasdaq.com/economic-institute/the-print",
    description: "Fresh economic and market perspectives from Nasdaq’s economic institute.",
    tag: "Economy",
    accent: "#F59E0B",
    tint: "#FFF7ED",
    icon: "TP",
  },
  {
    name: "Nasdaq Newsletters",
    url: "https://www.nasdaq.com/newsletters",
    description: "High-signal newsletters covering markets, business, and macro trends.",
    tag: "Finance",
    accent: "#EF4444",
    tint: "#FEE2E2",
    icon: "NQ",
  },
  {
    name: "Stratechery",
    url: "https://stratechery.com/",
    description: "Sharp analysis of technology, business strategy, and platform dynamics.",
    tag: "Strategy",
    accent: "#0F172A",
    tint: "#F1F5F9",
    icon: "S",
  },
  {
    name: "Moneyweb",
    url: "https://www.moneyweb.co.za/",
    description: "South African business and finance reporting for informed decision-making.",
    tag: "Business",
    accent: "#14B8A6",
    tint: "#CCFBF1",
    icon: "MW",
  },
  {
    name: "Daily Investor",
    url: "https://dailyinvestor.com/",
    description: "Accessible investment news and market education for everyday investors.",
    tag: "Investing",
    accent: "#EA580C",
    tint: "#FFF1E6",
    icon: "DI",
  },
];

export function NewslettersPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Insights</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Newsletters</h1>
        </div>
        <Button
          variant="outline"
          className="w-fit border-primary/40 text-primary hover:bg-primary/10"
          onClick={() => window.open("https://www.nasdaq.com/newsletters", "_blank", "noopener,noreferrer")}
        >
          Explore more
          <ArrowUpRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {newsletters.map((item) => (
          <Card
            key={item.name}
            className="group overflow-hidden border-border bg-card transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5"
          >
            <div
              className="border-b border-border px-4 py-4"
              style={{
                background: `linear-gradient(135deg, ${item.accent} 0%, ${item.tint} 100%)`,
                borderBottomColor: `${item.accent}33`,
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/40 text-sm font-bold shadow-sm"
                  style={{ background: "rgba(255,255,255,0.18)", color: item.accent }}
                >
                  {item.icon}
                </div>
                <span
                  className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
                  style={{ borderColor: `${item.accent}55`, color: item.accent, background: "rgba(255,255,255,0.5)" }}
                >
                  {item.tag}
                </span>
              </div>
            </div>

            <CardHeader className="pb-3 pt-5">
              <div className="flex items-start justify-between gap-4">
                <CardTitle className="text-xl font-semibold leading-tight text-foreground">{item.name}</CardTitle>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${item.name}`}
                  className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pb-5">
              <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Newspaper className="h-3.5 w-3.5" style={{ color: item.accent }} />
                  <span>Curated read</span>
                </div>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium transition-colors"
                  style={{ color: item.accent }}
                >
                  Open
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
