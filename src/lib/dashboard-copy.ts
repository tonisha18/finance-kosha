/**
 * dashboard-copy.ts
 * Centralized plain-language user-visible strings for the Dashboard.
 * Rule: Friendly, calm, zero jargon (no drift, runway, surplus, coverage, or savings rate).
 */

export const DASHBOARD_COPY = {
  greetingPrefix: "Hey",
  greetingFallback: "there",
  subtitle: "How is your money doing this month?",

  safeToSpend: {
    dialogTitle: "How your daily spending limit is calculated",
    dialogClose: "Got it",
    insufficientData: "Upload a statement or set your income to see how much you can safely spend.",
    btnUpload: "Upload statement",
    btnSetIncome: "My money details",
    howCalculatedLink: "See how we calculated this →",
    statusLabels: {
      on_track: "On track",
      careful: "Careful",
      over: "Over",
      insufficient: "Needs setup",
    },
    formulaExplainer: (
      expectedIncome: string,
      spentSoFar: string,
      reserved: string,
      daysLeft: number,
      perDay: string
    ) => [
      `Your expected income for this month is ${expectedIncome}.`,
      `You've already spent ${spentSoFar} so far.`,
      `We set aside ${reserved} for regular payments and savings goals.`,
      `With ${daysLeft} days left in the month, that leaves you with about ${perDay} per day to spend safely.`,
    ],
  },

  needsAttention: {
    heading: "Needs your attention",
    allClear: "All clear. Nothing needs your attention right now.",
    markAsSeen: "Mark as seen",
    seeAllAlerts: "See all alerts",
    reviewAction: "Review",
    adjustBudgetAction: "Adjust spending limit",
    checkPurchaseAction: "Check it",
  },

  monthSummary: {
    heading: "This month in one line",
    barEarnedLabel: "Money received",
    barSpentLabel: "Money spent",
    barKeptLabel: "Money left",
  },

  budgets: {
    heading: "Monthly spending limits",
    seeAll: "See all spending limits",
    emptyHeading: "Set a monthly spending limit to get warnings before you overspend",
    btnSuggest: "Suggest spending limits for me",
    statusLabels: {
      on_track: "On track",
      close: "Close",
      over: "Over",
    },
  },

  topCategories: {
    heading: "Your spending",
    seeAll: "See all transactions",
  },

  subscriptions: {
    heading: "Regular payments",
    manageLink: "Manage regular payments",
  },

  upcoming: {
    heading: "Coming up (next 7 days)",
    today: "today",
    tomorrow: "tomorrow",
    inDays: (d: number) => `in ${d} days`,
  },

  goals: {
    heading: "Your goals",
    seeAll: "See all goals",
    emptyPrompt: "Add a goal to start planning",
    btnAddGoal: "Add goal",
  },

  quickLook: {
    prompt: (count: number) => `${count} transaction${count > 1 ? "s" : ""} need${count === 1 ? "s" : ""} a quick look`,
    subtext: "Fixing categories teaches the app to classify them automatically next time.",
    btnReview: "Review now",
  },

  latestActivity: {
    heading: "Latest transactions",
    seeAll: "See all transactions",
  },

  details: {
    triggerShow: "See details and charts",
    triggerHide: "Hide details and charts",
    subtext: "For a closer look at daily trends and category breakdowns.",
  },

  emptyState: {
    heading: "Upload your first statement to see how you're doing",
    body: "Once you upload a bank statement, we'll calculate what you can safely spend, track your regular payments, and watch your monthly spending limits.",
    btnUpload: "Upload statement",
    btnProfile: "Set up my money details",
  },
};
