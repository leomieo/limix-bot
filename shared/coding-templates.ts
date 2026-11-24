const codingTemplates = new Set([
  "coder",
  "agency-ai-engineer",
  "agency-api-platform-engineer",
  "agency-backend-architect",
  "agency-code-reviewer",
  "agency-codebase-onboarding-engineer",
  "agency-data-engineer",
  "agency-data-visualization-engineer",
  "agency-desktop-app-engineer",
  "agency-developer-tooling-engineer",
  "agency-devops-automator",
  "agency-dx-engineer",
  "agency-frontend-developer",
  "agency-i18n-engineer",
  "agency-identity-access-engineer",
  "agency-minimal-change-engineer",
  "agency-mobile-release-engineer",
  "agency-payments-billing-engineer",
  "agency-platform-engineer",
  "agency-rag-pipeline-engineer",
  "agency-rapid-prototyper",
  "agency-realtime-collaboration-engineer",
  "agency-search-relevance-engineer",
  "agency-software-architect",
  "agency-sre",
  "agency-test-automation-engineer",
]);

export function isCodingTemplate(id: unknown): boolean {
  return typeof id === "string" && codingTemplates.has(id);
}
