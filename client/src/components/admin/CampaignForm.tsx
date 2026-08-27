"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ImagePlus, Search, Users, X } from "lucide-react";
import { getAudiencePreview, type CampaignPayload, type CampaignSchedulePayload } from "@/lib/api/campaigns";
import { listUsers } from "@/lib/api/users";
import { Button } from "@/components/ui/Button";
import type {
  ApiCampaign,
  ApiUser,
  CampaignAudienceType,
  CampaignAudiencePreview,
  CampaignChannel,
  CampaignChannelStatus,
  CampaignScheduleType,
} from "@/types/api";

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const CHANNEL_OPTIONS: { key: CampaignChannel; label: string }[] = [
  { key: "email", label: "Email" },
  { key: "sms", label: "SMS" },
  { key: "website", label: "Website Notification" },
];

const SCHEDULE_OPTIONS: { key: CampaignScheduleType; label: string }[] = [
  { key: "now", label: "Send Now" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "custom", label: "Custom Date & Time" },
];

export interface CampaignFormValues {
  title: string;
  message: string;
  audienceType: CampaignAudienceType;
  customerIds: string[];
  channels: CampaignChannel[];
  scheduleType: CampaignScheduleType;
  sendAt: string;
  dayOfWeek: number;
  dayOfMonth: number;
  hour: number;
  minute: number;
  removeImage: boolean;
}

function fromCampaign(campaign?: ApiCampaign): CampaignFormValues {
  if (!campaign) {
    return {
      title: "",
      message: "",
      audienceType: "all",
      customerIds: [],
      channels: ["email"],
      scheduleType: "now",
      sendAt: "",
      dayOfWeek: 1,
      dayOfMonth: 1,
      hour: 10,
      minute: 0,
      removeImage: false,
    };
  }
  return {
    title: campaign.title,
    message: campaign.message,
    audienceType: campaign.targetAudience.type,
    customerIds: campaign.targetAudience.customerIds,
    channels: campaign.channels,
    scheduleType: campaign.schedule.type,
    sendAt: campaign.schedule.sendAt ? campaign.schedule.sendAt.slice(0, 16) : "",
    dayOfWeek: campaign.schedule.dayOfWeek ?? 1,
    dayOfMonth: campaign.schedule.dayOfMonth ?? 1,
    hour: campaign.schedule.hour ?? 10,
    minute: campaign.schedule.minute ?? 0,
    removeImage: false,
  };
}

function toPayload(values: CampaignFormValues): CampaignPayload {
  let schedule: CampaignSchedulePayload;
  if (values.scheduleType === "custom") {
    schedule = { type: "custom", sendAt: new Date(values.sendAt).toISOString() };
  } else if (values.scheduleType === "weekly") {
    schedule = { type: "weekly", dayOfWeek: values.dayOfWeek, hour: values.hour, minute: values.minute };
  } else if (values.scheduleType === "monthly") {
    schedule = { type: "monthly", dayOfMonth: values.dayOfMonth, hour: values.hour, minute: values.minute };
  } else {
    schedule = { type: "now" };
  }

  return {
    title: values.title,
    message: values.message,
    targetAudience: { type: values.audienceType, customerIds: values.audienceType === "all" ? [] : values.customerIds },
    channels: values.channels,
    schedule,
    removeImage: values.removeImage,
  };
}

function formatRecipientLine(type: CampaignAudienceType, preview: CampaignAudiencePreview | null): string {
  const label = type === "all" ? "All Customers" : type === "specific" ? "Specific Customer" : "Selected Customers";
  if (!preview) return `${label} — …`;
  const count = type === "specific" ? Math.min(preview.total, 1) : preview.total;
  return `${label} — ${count.toLocaleString()} recipient${count === 1 ? "" : "s"}`;
}

export function CampaignForm({
  initial,
  channelStatus,
  error,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  initial?: ApiCampaign;
  channelStatus: CampaignChannelStatus | null;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (payload: CampaignPayload, image: File | null) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<CampaignFormValues>(() => fromCampaign(initial));
  const [image, setImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(initial?.image?.url ?? null);

  const [customerSearch, setCustomerSearch] = useState("");
  const [customerOptions, setCustomerOptions] = useState<ApiUser[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<Map<string, ApiUser>>(new Map());

  const [audiencePreview, setAudiencePreview] = useState<CampaignAudiencePreview | null>(null);

  // Debounced customer search for the "Selected"/"Specific" pickers.
  useEffect(() => {
    if (values.audienceType === "all") return;
    const t = setTimeout(() => {
      listUsers({ role: "customer", search: customerSearch || undefined, limit: 20 })
        .then(({ data }) => setCustomerOptions(data.users))
        .catch(() => setCustomerOptions([]));
    }, 250);
    return () => clearTimeout(t);
  }, [customerSearch, values.audienceType]);

  // Live recipient count — recomputed whenever the audience changes.
  useEffect(() => {
    const t = setTimeout(() => {
      getAudiencePreview(values.audienceType, values.customerIds)
        .then(({ data }) => setAudiencePreview(data))
        .catch(() => setAudiencePreview(null));
    }, 250);
    return () => clearTimeout(t);
  }, [values.audienceType, values.customerIds]);

  function toggleChannel(channel: CampaignChannel) {
    setValues((prev) => ({
      ...prev,
      channels: prev.channels.includes(channel)
        ? prev.channels.filter((c) => c !== channel)
        : [...prev.channels, channel],
    }));
  }

  function toggleSelectedCustomer(customer: ApiUser) {
    setSelectedCustomers((prev) => {
      const next = new Map(prev);
      if (next.has(customer._id)) next.delete(customer._id);
      else next.set(customer._id, customer);
      return next;
    });
    setValues((prev) => {
      const has = prev.customerIds.includes(customer._id);
      return { ...prev, customerIds: has ? prev.customerIds.filter((id) => id !== customer._id) : [...prev.customerIds, customer._id] };
    });
  }

  function pickSpecificCustomer(customer: ApiUser) {
    setSelectedCustomers(new Map([[customer._id, customer]]));
    setValues((prev) => ({ ...prev, customerIds: [customer._id] }));
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setValues((prev) => ({ ...prev, removeImage: false }));
  }

  function removeImage() {
    setImage(null);
    setImagePreviewUrl(null);
    setValues((prev) => ({ ...prev, removeImage: true }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (values.channels.length === 0) return;
    onSubmit(toPayload(values), image);
  }

  const channelSummary = values.channels
    .map((c) => CHANNEL_OPTIONS.find((o) => o.key === c)?.label)
    .filter(Boolean)
    .join(" + ");

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <label className={labelClasses}>Campaign Title *</label>
        <input
          required
          maxLength={150}
          value={values.title}
          onChange={(e) => setValues((prev) => ({ ...prev, title: e.target.value }))}
          className={fieldClasses}
          placeholder="e.g. Eid Mega Sale"
        />
      </div>

      <div>
        <label className={labelClasses}>Message Content *</label>
        <textarea
          required
          rows={5}
          maxLength={5000}
          value={values.message}
          onChange={(e) => setValues((prev) => ({ ...prev, message: e.target.value }))}
          className={fieldClasses}
          placeholder="What do you want to tell your customers?"
        />
      </div>

      <div>
        <label className={labelClasses}>Banner Image (optional)</label>
        {imagePreviewUrl ? (
          <div className="relative inline-block">
            <Image src={imagePreviewUrl} alt="" width={220} height={120} className="rounded border border-brown-600/10 object-cover" />
            <button
              type="button"
              onClick={removeImage}
              aria-label="Remove image"
              className="absolute -right-2 -top-2 flex size-6 cursor-pointer items-center justify-center rounded-full bg-delete text-white transition-colors duration-200 ease-in-out hover:bg-delete-hover"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <label className="flex w-fit cursor-pointer items-center gap-2 rounded border border-dashed border-brown-600/30 px-4 py-3 text-sm text-brown-500 hover:border-brown-600/50">
            <ImagePlus size={16} />
            Add an image
            <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </label>
        )}
      </div>

      {/* -- Target Audience -- */}
      <div>
        <label className={labelClasses}>Target Audience *</label>
        <div className="flex flex-wrap gap-3">
          {(["all", "selected", "specific"] as CampaignAudienceType[]).map((type) => (
            <label key={type} className="flex cursor-pointer items-center gap-1.5 text-sm text-brown-600">
              <input
                type="radio"
                name="audienceType"
                checked={values.audienceType === type}
                onChange={() => setValues((prev) => ({ ...prev, audienceType: type, customerIds: [] }))}
                className="accent-green-900"
              />
              {type === "all" ? "All Customers" : type === "selected" ? "Selected Customers" : "Specific Customer"}
            </label>
          ))}
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-green-950">
          <Users size={14} className="text-brown-500" />
          {formatRecipientLine(values.audienceType, audiencePreview)}
        </p>

        {values.audienceType !== "all" && (
          <div className="mt-3 rounded border border-brown-600/10 bg-cream-50 p-3">
            <div className="relative mb-2">
              <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-brown-500" />
              <input
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Search customers by name or email..."
                className="h-8 w-full rounded border border-brown-600/20 bg-surface pl-7 pr-2 text-xs text-green-950 placeholder:text-brown-500/60 focus:outline-none"
              />
            </div>
            <div className="max-h-40 overflow-y-auto">
              {customerOptions.length === 0 ? (
                <p className="px-1 py-2 text-xs text-brown-500">No customers found.</p>
              ) : (
                customerOptions.map((customer) => (
                  <label
                    key={customer._id}
                    className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1.5 text-sm text-brown-600 hover:bg-green-950/5"
                  >
                    <input
                      type={values.audienceType === "specific" ? "radio" : "checkbox"}
                      name="customerPick"
                      checked={values.customerIds.includes(customer._id)}
                      onChange={() =>
                        values.audienceType === "specific" ? pickSpecificCustomer(customer) : toggleSelectedCustomer(customer)
                      }
                      className="accent-green-900"
                    />
                    <span className="truncate">
                      {customer.name} <span className="text-brown-500">({customer.email})</span>
                    </span>
                  </label>
                ))
              )}
            </div>
            {selectedCustomers.size > 0 && (
              <p className="mt-1 px-1 text-xs text-brown-500">{selectedCustomers.size} customer(s) selected</p>
            )}
          </div>
        )}
      </div>

      {/* -- Delivery Channel -- */}
      <div>
        <label className={labelClasses}>Delivery Channel *</label>
        <div className="flex flex-col gap-2">
          {CHANNEL_OPTIONS.map((option) => {
            const isConfigured = channelStatus ? channelStatus[option.key] : true;
            return (
              <label key={option.key} className="flex items-center gap-2 text-sm text-brown-600">
                <input
                  type="checkbox"
                  checked={values.channels.includes(option.key)}
                  onChange={() => toggleChannel(option.key)}
                  className="accent-green-900"
                />
                {option.label}
                <span
                  className={
                    isConfigured
                      ? "rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-bold uppercase text-green-900"
                      : "rounded-full bg-cream-300 px-2 py-0.5 text-[10px] font-bold uppercase text-brown-500"
                  }
                >
                  {isConfigured ? "Available" : "Not Configured"}
                </span>
              </label>
            );
          })}
        </div>
        {values.channels.includes("sms") && channelStatus && !channelStatus.sms && (
          <p className="mt-1 text-xs text-brown-500">
            SMS isn&apos;t connected to a provider yet — this campaign will still send normally through its other
            channels, and SMS will simply be skipped until a provider is configured.
          </p>
        )}
        {values.channels.length === 0 && <p className="mt-1 text-xs text-danger">Select at least one channel.</p>}
      </div>

      {/* -- Schedule -- */}
      <div>
        <label className={labelClasses}>Schedule *</label>
        <div className="mb-3 flex flex-wrap gap-3">
          {SCHEDULE_OPTIONS.map((option) => (
            <label key={option.key} className="flex cursor-pointer items-center gap-1.5 text-sm text-brown-600">
              <input
                type="radio"
                name="scheduleType"
                checked={values.scheduleType === option.key}
                onChange={() => setValues((prev) => ({ ...prev, scheduleType: option.key }))}
                className="accent-green-900"
              />
              {option.label}
            </label>
          ))}
        </div>

        {values.scheduleType === "weekly" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClasses}>Day of Week</label>
              <select
                value={values.dayOfWeek}
                onChange={(e) => setValues((prev) => ({ ...prev, dayOfWeek: Number(e.target.value) }))}
                className={fieldClasses}
              >
                {DAY_LABELS.map((day, idx) => (
                  <option key={day} value={idx}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClasses}>Time</label>
              <input
                type="time"
                value={`${String(values.hour).padStart(2, "0")}:${String(values.minute).padStart(2, "0")}`}
                onChange={(e) => {
                  const [h, m] = e.target.value.split(":").map(Number);
                  setValues((prev) => ({ ...prev, hour: h, minute: m }));
                }}
                className={fieldClasses}
              />
            </div>
          </div>
        )}

        {values.scheduleType === "monthly" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClasses}>Day of Month</label>
              <input
                type="number"
                min={1}
                max={31}
                value={values.dayOfMonth}
                onChange={(e) => setValues((prev) => ({ ...prev, dayOfMonth: Number(e.target.value) }))}
                className={fieldClasses}
              />
              <p className="mt-1 text-xs text-brown-500">A shorter month sends on its own last day.</p>
            </div>
            <div>
              <label className={labelClasses}>Time</label>
              <input
                type="time"
                value={`${String(values.hour).padStart(2, "0")}:${String(values.minute).padStart(2, "0")}`}
                onChange={(e) => {
                  const [h, m] = e.target.value.split(":").map(Number);
                  setValues((prev) => ({ ...prev, hour: h, minute: m }));
                }}
                className={fieldClasses}
              />
            </div>
          </div>
        )}

        {values.scheduleType === "custom" && (
          <div>
            <label className={labelClasses}>Send Date & Time</label>
            <input
              required
              type="datetime-local"
              value={values.sendAt}
              onChange={(e) => setValues((prev) => ({ ...prev, sendAt: e.target.value }))}
              className={fieldClasses}
            />
          </div>
        )}
      </div>

      {/* -- Summary -- */}
      <div className="rounded-lg border border-gold-500/30 bg-gold-soft p-4 text-sm text-gold-700">
        <p>{formatRecipientLine(values.audienceType, audiencePreview)}</p>
        <p className="mt-1">Delivery Channels: {channelSummary || "None selected"}</p>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end gap-3 border-t border-brown-600/10 pt-4">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting || values.channels.length === 0}>
          {isSubmitting ? "Saving..." : initial ? "Save Changes" : "Create Draft"}
        </Button>
      </div>
    </form>
  );
}
