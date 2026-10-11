export type NavLink = {
  href: string;
  label: string;
  description: string;
};

export type NavGroup = {
  label: string;
  links: NavLink[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    links: [
      {
        href: "/dashboard",
        label: "Dashboard",
        description: "View workspace metrics and activity",
      },
      {
        href: "/ask",
        label: "Ask",
        description: "Ask an agent using verified knowledge",
      },
      {
        href: "/retrieval-history",
        label: "Retrieval History",
        description: "Review previous agent retrievals",
      },
      {
        href: "/search",
        label: "Search",
        description: "Search across knowledge, agents, logs, and retrievals",
      },
    ],
  },
  {
    label: "Knowledge",
    links: [
      {
        href: "/documents",
        label: "Documents",
        description: "Write collaboratively and connect documents to the knowledge graph",
      },
      {
        href: "/knowledge",
        label: "Knowledge",
        description: "Create, import, edit, and export knowledge",
      },
      {
        href: "/graph",
        label: "Ontology Explorer",
        description: "Explore connected documents, agent context, and the knowledge ontology",
      },
      {
        href: "/agents",
        label: "Agents",
        description: "Manage agents and their roles",
      },
    ],
  },
  {
    label: "Governance",
    links: [
      {
        href: "/approvals",
        label: "Approvals",
        description: "Approve or reject draft knowledge",
      },
      {
        href: "/reviews",
        label: "Reviews",
        description: "Review stale knowledge",
      },
      {
        href: "/audit",
        label: "Audit Logs",
        description: "Track workspace activity",
      },
    ],
  },
  {
    label: "Admin",
    links: [
      {
        href: "/members",
        label: "Members",
        description: "Invite and manage team members",
      },
      {
        href: "/settings",
        label: "Settings",
        description: "Manage organization defaults",
      },
    ],
  },
];

export const NAV_COMMANDS = NAV_GROUPS.flatMap((group) =>
  group.links.map((link) => ({ ...link, group: group.label }))
);
