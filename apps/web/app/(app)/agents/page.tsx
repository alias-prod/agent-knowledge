"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import Link from "next/link";
import { useCurrentOrganization } from "@/lib/auth-context";
import { canManageKnowledge } from "@/lib/role";
import { useCurrentRole } from "@/lib/useCurrentRole";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "../../components/ToastProvider";


export default function AgentsPage() {
  const organizationId = useCurrentOrganization();
    const { user } = useAuth();
    const { showToast } = useToast();

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<
        "all" | "active" | "disabled"
    >("all");
    const [roleFilter, setRoleFilter] = useState("all");

    const agents = useQuery(api.agents.listAgents, {
        organizationId: organizationId,
        search,
        status: statusFilter,
        role: roleFilter,
    });
    const createAgent = useMutation(api.agents.createAgent);
    const updateAgent = useMutation(api.agents.updateAgent);
    const deleteAgent = useMutation(api.agents.deleteAgent);

    const currentRole = useCurrentRole();
    const canManage = canManageKnowledge(currentRole);

    const [editingId, setEditingId] = useState<Id<"agents"> | null>(null);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [role, setRole] = useState("Support Agent");
    const [status, setStatus] = useState<"active" | "disabled">("active");

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!name.trim() || !description.trim()) return;

        const wasEditing = editingId !== null;

        try {
            if (editingId) {
                await updateAgent({
                    id: editingId,
                    name,
                    description,
                    role,
                    status,
                    organizationId: organizationId,
                    actorEmail: user?.email ?? "unknown-user",
                    workosUserId: user?.id ?? "",
                });

                setEditingId(null);
            } else {
                const createPayload = {
                    name,
                    description,
                    role,
                    status,
                    organizationId: organizationId,
                    actorEmail: user?.email ?? "unknown-user",
                    workosUserId: user?.id ?? "",
                };

                await createAgent(createPayload);
            }

            showToast({
                type: "success",
                title: wasEditing ? "Agent updated" : "Agent created",
                description: `${name} was saved.`,
            });

            setName("");
            setDescription("");
            setRole("Support Agent");
            setStatus("active");
        } catch (error) {
            showToast({
                type: "error",
                title: wasEditing ? "Agent update failed" : "Agent creation failed",
                description:
                    error instanceof Error ? error.message : "Could not save the agent.",
            });
        }
    }

    async function handleDeleteAgent(id: Id<"agents">) {
        try {
            await deleteAgent({
                id,
                actorEmail: user?.email ?? "unknown-user",
                workosUserId: user?.id ?? "",
            });

            showToast({
                type: "success",
                title: "Agent deleted",
                description: "The agent was removed from the registry.",
            });
        } catch (error) {
            showToast({
                type: "error",
                title: "Agent deletion failed",
                description:
                    error instanceof Error ? error.message : "Could not delete the agent.",
            });
        }
    }

    function handleEdit(agent: {
        _id: Id<"agents">;
        name: string;
        description: string;
        role?: string;
        status: "active" | "disabled";
    }) {
        setEditingId(agent._id);
        setName(agent.name);
        setDescription(agent.description);
        setRole(agent.role ?? "Support Agent");
        setStatus(agent.status);
    }

    return (
        <div className="ak-page">
            <header className="border-b border-neutral-800/80 pb-6">
                <p className="ak-header-eyebrow">
                    Agent Registry
                </p>
                <h1 className="ak-header-title">Agents</h1>
                <p className="ak-header-description">
                    Create and manage the AI agents that will use your company
                    knowledge.
                </p>
            </header>

            {canManage && (

                <form
                    onSubmit={handleSubmit}
                    className="ak-card flex flex-col gap-5"
                >
                    <div className="border-b border-neutral-800/80 pb-5">
                        <p className="ak-header-eyebrow">
                            {editingId ? "Edit agent" : "Create"}
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                            {editingId ? "Update agent" : "Create an agent"}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-neutral-400">
                            Define the role and operating purpose for this agent.
                        </p>
                    </div>
                    <div className="grid gap-5 md:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <label className="ak-label">
                                Agent name
                            </label>
                            <input
                                className="ak-input"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Customer Support Agent"
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="ak-label">
                                Role
                            </label>
                            <select
                                className="ak-select"
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                            >
                                <option>Support Agent</option>
                                <option>Developer Agent</option>
                                <option>Sales Agent</option>
                                <option>Operations Agent</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="ak-label">
                            Description
                        </label>
                        <textarea
                            className="ak-textarea min-h-28"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Explain what this agent does..."
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="ak-label">
                            Status
                        </label>
                        <select
                            className="ak-select md:w-72"
                            value={status}
                            onChange={(e) =>
                                setStatus(e.target.value as "active" | "disabled")
                            }
                        >
                            <option value="active">Active</option>
                            <option value="disabled">Disabled</option>
                        </select>
                    </div>

                    <div className="flex gap-3">
                        <button
                            type="submit"
                            className="ak-button-primary w-fit"
                        >
                            {editingId ? "Update Agent" : "Create Agent"}
                        </button>

                        {editingId && (
                            <button
                                type="button"
                                onClick={() => {
                                    setEditingId(null);
                                    setName("");
                                    setDescription("");
                                    setRole("Support Agent");
                                    setStatus("active");
                                }}
                                className="ak-button-secondary w-fit"
                            >
                                Cancel Edit
                            </button>
                        )}
                    </div>
                </form>

            )}

            <section className="space-y-4">
                <div className="ak-card flex flex-col gap-5">
                    <div>
                        <p className="ak-header-eyebrow">Registry</p>
                        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                            Agent list
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-neutral-400">
                            Filter and manage the agents connected to workspace knowledge.
                        </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_220px]">
                        <input
                            className="ak-input"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search agents..."
                        />

                        <select
                            className="ak-select"
                            value={statusFilter}
                            onChange={(e) =>
                                setStatusFilter(e.target.value as "all" | "active" | "disabled")
                            }
                        >
                            <option value="all">All statuses</option>
                            <option value="active">Active</option>
                            <option value="disabled">Disabled</option>
                        </select>

                        <select
                            className="ak-select"
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                        >
                            <option value="all">All roles</option>
                            <option>Support Agent</option>
                            <option>Developer Agent</option>
                            <option>Sales Agent</option>
                            <option>Operations Agent</option>
                        </select>
                    </div>
                </div>

                {agents === undefined ? (
                    <div className="grid gap-4 md:grid-cols-2">
                        {[1, 2, 3, 4].map((item) => (
                            <div
                                key={item}
                                className="ak-card"
                            >
                                <div className="h-5 w-1/2 rounded bg-neutral-800" />
                                <div className="mt-3 h-4 w-1/3 rounded bg-neutral-800" />
                                <div className="mt-5 space-y-2">
                                    <div className="h-4 w-full rounded bg-neutral-800" />
                                    <div className="h-4 w-2/3 rounded bg-neutral-800" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : agents.length === 0 ? (
                    <div className="ak-card">
                        <p className="font-medium text-neutral-200">No matching agents found.</p>
                        <p className="mt-1 text-sm text-neutral-500">
                            Try changing your search, status, or role filters.
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {agents.map((agent) => (
                            <article
                                key={agent._id}
                                className="ak-card-hover"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <h3 className="break-words text-lg font-semibold">{agent.name}</h3>
                                        <p className="mt-1 text-sm text-neutral-400">
                                            {agent.role ?? "Support Agent"}
                                        </p>
                                    </div>

                                    <span className={`${agent.status === "active" ? "ak-status-success" : "ak-status-neutral"} shrink-0`}>
                                        {agent.status}
                                    </span>
                                </div>

                                <p className="mt-4 text-sm leading-6 text-neutral-300">
                                    {agent.description}
                                </p>

                                <div className="mt-5 flex flex-col gap-3 border-t border-neutral-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
                                    <Link
                                        href={`/agents/${agent._id}`}
                                        className="ak-button-primary w-full px-3.5 py-2 sm:w-fit"
                                    >
                                        Open agent
                                    </Link>

                                    {canManage && (
                                        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                                            <button
                                                type="button"
                                                onClick={() => handleEdit(agent)}
                                                className="ak-button-secondary px-3.5 py-2"
                                            >
                                                Edit
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => void handleDeleteAgent(agent._id)}
                                                className="ak-button-danger px-3.5 py-2"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
