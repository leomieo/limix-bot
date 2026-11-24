import { INDUSTRY_PROFILES, type IndustryProfile } from "../shared/industry-profiles.ts";
import { industryRoleBot, SUPER_SUPPORT_BOT } from "../shared/industry-templates.ts";
import type { ReadyBot } from "../shared/ready-bots.ts";
import { parsePackageDocument, type PackageDocument } from "../shared/package-format.ts";
import type { TeamCatalogEntry } from "./team-library.ts";

const teamSlug = (profile: IndustryProfile) => `industry-${profile.slug}`;
const teamName = (profile: IndustryProfile) => `Nhóm ${profile.name}`;

export const industryTeamCatalog: TeamCatalogEntry[] = INDUSTRY_PROFILES.map((profile) => ({
  slug: teamSlug(profile), name: teamName(profile), summary: profile.description,
  category: profile.name, members: profile.roles.length + 1, skills: ["industry-customer-care"],
  requires: { apps: [] }, manifest: `/api/team-library/teams/${teamSlug(profile)}`, builtIn: true,
}));

export function industryTeam(slug: string): PackageDocument | undefined {
  const profile = INDUSTRY_PROFILES.find((item) => teamSlug(item) === slug);
  if (!profile) return undefined;
  const roster = profile.roles.map((role) => `${role.name} — ${role.description}`).join("\n");
  const handoff = [
    "Trong phòng nội bộ, CSKH nhận yêu cầu và chọn một bộ phận theo danh sách bên dưới. Khi giao việc trong phòng, dùng @ kèm đúng tên hiển thị của một thành viên đang ở phòng. Trong kênh khách hàng, chỉ soạn tóm tắt bàn giao.",
    "Khi cần bàn giao, ghi bộ phận nhận, câu hỏi còn mở và nguồn đã kiểm tra. Chỉ ghi dữ kiện cần thiết đã được phép chia sẻ trong phòng.",
    "Tách tin nhắn trả khách khỏi ghi chú nội bộ. Chỉ báo đã giao việc hoặc đã sửa hồ sơ khi hệ thống có xác nhận.",
    "Khi gặp yêu cầu duyệt, thông tin riêng hoặc hai bộ phận chưa thống nhất, dừng chuyển tiếp và nhờ người phụ trách xử lý.",
    roster,
  ].join("\n");
  const agent = (key: string, bot: ReadyBot) => ({
    key, name: bot.name, title: bot.title, description: bot.description, soul: bot.soul,
    appearance: bot.look, approval: "ask", playbooks: ["handoff"],
  });
  const lead = agent("care", SUPER_SUPPORT_BOT);
  lead.soul += `\n\n${profile.name}\n${handoff}`;
  const agents = [lead, ...profile.roles.map((role) => agent(role.slug, industryRoleBot(profile, role)))];
  return parsePackageDocument({
    format: "openmaus.package", version: 2,
    package: {
      id: slug, release: "1.0.0", name: teamName(profile), tagline: profile.description, summary: profile.description,
      category: profile.name, author: { name: "Limix Bot" }, license: "Apache-2.0",
      outcomes: ["Bàn giao đúng bộ phận và phản hồi khách từ dữ kiện đã xác minh."], setupMinutes: 5,
      requirements: { apps: [], capabilities: [] },
      team: { name: teamName(profile), brief: handoff },
      agents,
      rooms: [{ key: "care-desk", name: `Tiếp nhận · ${profile.name}`, members: agents.map((a) => a.key),
        bulletin: handoff, defaultResponder: { kind: "agent", agent: lead.key } }],
      playbooks: [{ key: "handoff", name: "Tiếp nhận và bàn giao", summary: profile.description,
        triggers: ["chuyển bộ phận", "bàn giao ca", "cần người duyệt"], instructions: handoff }],
    },
  });
}
