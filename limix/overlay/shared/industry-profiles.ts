import profiles from "../skills/industry-customer-care/assets/industry-profiles.json" with { type: "json" };

export interface IndustryRole {
  slug: string;
  name: string;
  title: string;
  description: string;
  instructions: string;
  inputs: string;
  handoff: string;
}

export interface IndustryProfile {
  slug: string;
  name: string;
  description: string;
  roles: readonly IndustryRole[];
}

export const INDUSTRY_PROFILES: readonly IndustryProfile[] = profiles;
