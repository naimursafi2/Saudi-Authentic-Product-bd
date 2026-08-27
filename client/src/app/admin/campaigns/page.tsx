"use client";

import { useEffect, useState } from "react";
import { Megaphone, Plus, Pencil, Trash2, Send, Pause, Play, Check, X as XIcon, History } from "lucide-react";
import {
  approveCampaign,
  createCampaign,
  deleteCampaign,
  getChannelStatus,
  listCampaigns,
  pauseCampaign,
  rejectCampaign,
  resumeCampaign,
  sendCampaignNow,
  submitCampaign,
  updateCampaign,
} from "@/lib/api/campaigns";
import { ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/context/ConfirmDialogContext";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { Modal } from "@/components/admin/Modal";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { ActionButton, ActionButtonGroup } from "@/components/ui/ActionButton";
import { Button } from "@/components/ui/Button";
import { CampaignForm } from "@/components/admin/CampaignForm";
import type { ApiCampaign, CampaignChannelStatus, CampaignStatus, Pagination } from "@/types/api";

const STATUS_TABS: { key: CampaignStatus | undefined; label: string }[] = [
  { key: undefined, label: "All" },
  { key: "draft", label: "Draft" },
  { key: "pending_approval", label: "Pending Approval" },
  { key: "approved", label: "Approved" },
  { key: "scheduled", label: "Scheduled" },
  { key: "sending", label: "Sending" },
  { key: "sent", label: "Sent" },
  { key: "paused", label: "Paused" },
  { key: "rejected", label: "Rejected" },
  { key: "failed", label: "Failed" },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function creatorId(campaign: ApiCampaign): string {
  return typeof campaign.createdBy === "string" ? campaign.createdBy : campaign.createdBy._id;
}

function creatorName(campaign: ApiCampaign): string {
  return typeof campaign.createdBy === "string" ? campaign.createdBy : campaign.createdBy.name;
}

function describeSchedule(campaign: ApiCampaign): string {
  const { schedule } = campaign;
  const time = (h?: number, m?: number) => `${String(h ?? 0).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}`;
  if (schedule.type === "now") return "Send Now";
  if (schedule.type === "custom") return schedule.sendAt ? new Date(schedule.sendAt).toLocaleString() : "Custom";
  if (schedule.type === "weekly") return `Weekly · ${DAY_LABELS[schedule.dayOfWeek ?? 0]} ${time(schedule.hour, schedule.minute)}`;
  return `Monthly · Day ${schedule.dayOfMonth} ${time(schedule.hour, schedule.minute)}`;
}

export default function AdminCampaignsPage() {
  const { user, hasPermission } = useAuth();
  const confirmDialog = useConfirm();

  const canCreate = hasPermission("campaigns.create");
  const canEdit = hasPermission("campaigns.edit");
  const canApprove = hasPermission("campaigns.approve");
  const canSend = hasPermission("campaigns.send");
  const canDelete = hasPermission("campaigns.delete");

  const [campaigns, setCampaigns] = useState<ApiCampaign[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<CampaignStatus | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const [channelStatus, setChannelStatus] = useState<CampaignChannelStatus | null>(null);
  const [editing, setEditing] = useState<ApiCampaign | "new" | null>(null);
  const [historyOf, setHistoryOf] = useState<ApiCampaign | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function load() {
    setIsLoading(true);
    listCampaigns({ status, page, limit: 20 })
      .then(({ data, pagination: pg }) => {
        setCampaigns(data.campaigns);
        setPagination(pg ?? null);
        setError(null);
      })
      .catch(() => setError("Could not load campaigns."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [page, status]);

  useEffect(() => {
    getChannelStatus()
      .then(({ data }) => setChannelStatus(data))
      .catch(() => setChannelStatus(null));
  }, []);

  function canEditCampaign(campaign: ApiCampaign): boolean {
    if (!canEdit) return false;
    if (campaign.status !== "draft" && campaign.status !== "rejected") return false;
    return user?.role === "super_admin" || creatorId(campaign) === user?._id;
  }

  async function handleSubmit(payload: Parameters<typeof createCampaign>[0], image: File | null) {
    setFormError(null);
    setIsSubmitting(true);
    try {
      if (editing === "new") {
        await createCampaign(payload, image);
      } else if (editing) {
        await updateCampaign(editing._id, payload, image);
      }
      setEditing(null);
      load();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Could not save campaign.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function runAction(id: string, action: () => Promise<unknown>) {
    setActionError(null);
    setActingId(id);
    try {
      await action();
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not complete this action.");
    } finally {
      setActingId(null);
    }
  }

  async function handleSubmitForApproval(campaign: ApiCampaign) {
    await runAction(campaign._id, () => submitCampaign(campaign._id));
  }

  async function handleApprove(campaign: ApiCampaign) {
    await runAction(campaign._id, () => approveCampaign(campaign._id));
  }

  async function handleReject(campaign: ApiCampaign) {
    const note = prompt("Reason for rejecting (optional):");
    // prompt() returns null only on Cancel — an empty confirmed string
    // should still reject, same fix documented project-wide for this pattern.
    if (note === null) return;
    await runAction(campaign._id, () => rejectCampaign(campaign._id, note || undefined));
  }

  async function handleSendNow(campaign: ApiCampaign) {
    const ok = await confirmDialog({
      title: "Send Campaign Now",
      message: `Send "${campaign.title}" immediately, regardless of its configured schedule?`,
      confirmLabel: "Send Now",
    });
    if (!ok) return;
    await runAction(campaign._id, () => sendCampaignNow(campaign._id));
  }

  async function handlePause(campaign: ApiCampaign) {
    await runAction(campaign._id, () => pauseCampaign(campaign._id));
  }

  async function handleResume(campaign: ApiCampaign) {
    await runAction(campaign._id, () => resumeCampaign(campaign._id));
  }

  async function handleDelete(campaign: ApiCampaign) {
    const ok = await confirmDialog({
      title: "Delete Campaign",
      message: `Delete "${campaign.title}"? This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    await runAction(campaign._id, () => deleteCampaign(campaign._id));
  }

  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Create and send promotional, informational and engagement messages to your customers."
        action={
          canCreate && (
            <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
              <Plus size={14} /> New Campaign
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.label}
            onClick={() => {
              setStatus(tab.key);
              setPage(1);
            }}
            className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
              status === tab.key ? "bg-brand-deep-2 text-white" : "bg-cream-300 text-brown-600 hover:bg-cream-400"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {actionError && <p className="mb-4 text-sm text-danger">{actionError}</p>}

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : campaigns.length === 0 ? (
        <EmptyState icon={Megaphone} title="No campaigns yet" description="Create your first customer campaign to get started." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Audience</th>
                <th className="px-4 py-3">Channels</th>
                <th className="px-4 py-3">Schedule</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign._id} className="border-b border-brown-600/10 last:border-none">
                  <td className="px-4 py-3">
                    <span className="block font-medium text-green-950">{campaign.title}</span>
                    <span className="block text-xs text-brown-500">by {creatorName(campaign)}</span>
                  </td>
                  <td className="px-4 py-3 capitalize text-brown-600">{campaign.targetAudience.type}</td>
                  <td className="px-4 py-3 text-brown-600">{campaign.channels.join(", ")}</td>
                  <td className="px-4 py-3 text-brown-600">{describeSchedule(campaign)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={campaign.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ActionButtonGroup>
                      {campaign.deliveries.length > 0 && (
                        <ActionButton tone="info" onClick={() => setHistoryOf(campaign)}>
                          <History size={13} />
                          History
                        </ActionButton>
                      )}
                      {canEditCampaign(campaign) && (
                        <ActionButton tone="info" onClick={() => setEditing(campaign)}>
                          <Pencil size={13} />
                          Edit
                        </ActionButton>
                      )}
                      {canEditCampaign(campaign) && (
                        <Button
                          variant="primary"
                          size="xs"
                          disabled={actingId === campaign._id}
                          onClick={() => handleSubmitForApproval(campaign)}
                        >
                          Submit
                        </Button>
                      )}
                      {canApprove && campaign.status === "pending_approval" && (
                        <>
                          <ActionButton tone="success" disabled={actingId === campaign._id} onClick={() => handleApprove(campaign)}>
                            <Check size={13} />
                            Approve
                          </ActionButton>
                          <ActionButton tone="danger" disabled={actingId === campaign._id} onClick={() => handleReject(campaign)}>
                            <XIcon size={13} />
                            Reject
                          </ActionButton>
                        </>
                      )}
                      {canSend && ["draft", "approved", "scheduled", "paused"].includes(campaign.status) && (
                        <ActionButton tone="success" disabled={actingId === campaign._id} onClick={() => handleSendNow(campaign)}>
                          <Send size={13} />
                          Send Now
                        </ActionButton>
                      )}
                      {canSend && campaign.status === "scheduled" && (
                        <ActionButton tone="neutral" disabled={actingId === campaign._id} onClick={() => handlePause(campaign)}>
                          <Pause size={13} />
                          Pause
                        </ActionButton>
                      )}
                      {canSend && campaign.status === "paused" && (
                        <ActionButton tone="success" disabled={actingId === campaign._id} onClick={() => handleResume(campaign)}>
                          <Play size={13} />
                          Resume
                        </ActionButton>
                      )}
                      {canDelete && (
                        <ActionButton tone="danger" disabled={actingId === campaign._id} onClick={() => handleDelete(campaign)}>
                          <Trash2 size={13} />
                          Delete
                        </ActionButton>
                      )}
                    </ActionButtonGroup>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 pb-4">
            <AdminPagination pagination={pagination} onPageChange={setPage} />
          </div>
        </div>
      )}

      {editing && (
        <Modal title={editing === "new" ? "New Campaign" : "Edit Campaign"} onClose={() => setEditing(null)} wide>
          <CampaignForm
            initial={editing === "new" ? undefined : editing}
            channelStatus={channelStatus}
            error={formError}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}

      {historyOf && (
        <Modal title={`Delivery History — ${historyOf.title}`} onClose={() => setHistoryOf(null)} wide>
          <div className="flex flex-col gap-4">
            {[...historyOf.deliveries].reverse().map((delivery) => (
              <div key={delivery._id} className="rounded border border-brown-600/10 p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-brown-500">
                  {new Date(delivery.triggeredAt).toLocaleString()} &middot; {delivery.trigger} &middot;{" "}
                  {delivery.recipientCount} recipient(s)
                </p>
                <div className="flex flex-col gap-1.5">
                  {delivery.channelResults.map((result) => (
                    <div key={result.channel} className="flex items-center gap-2 text-sm">
                      <span className="w-20 capitalize text-brown-600">{result.channel}</span>
                      <StatusBadge status={result.status} />
                      {result.status === "skipped" ? (
                        <span className="text-xs text-brown-500">{result.skippedReason}</span>
                      ) : (
                        <span className="text-xs text-brown-500">
                          {result.successCount} sent, {result.failureCount} failed
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
