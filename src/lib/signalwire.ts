/**
 * SignalWire Fax API client
 * Direct REST API calls — no Base44 integration credits
 *
 * SignalWire uses Twilio-compatible REST API for fax:
 * POST /api/laml/2010-04-01/Accounts/{ProjectID}/Faxes
 */

const SPACE_URL = process.env.SIGNALWIRE_SPACE_URL!;
const PROJECT_ID = process.env.SIGNALWIRE_PROJECT_ID!;
const API_TOKEN = process.env.SIGNALWIRE_API_TOKEN!;
const FAX_NUMBER = process.env.SIGNALWIRE_FAX_NUMBER || "+18882789949";

const BASE_URL = `https://${SPACE_URL}/api/laml/2010-04-01/Accounts/${PROJECT_ID}`;

function authHeader(): string {
  return "Basic " + Buffer.from(`${PROJECT_ID}:${API_TOKEN}`).toString("base64");
}

export interface SendFaxParams {
  to: string;
  mediaUrl: string; // URL to the PDF to fax
  from?: string;
  statusCallback?: string; // webhook URL for status updates
}

export interface FaxResource {
  sid: string;
  account_sid: string;
  from: string;
  to: string;
  status: string;
  direction: string;
  num_pages: number | null;
  duration: number | null;
  media_url: string | null;
  date_created: string;
  date_updated: string;
}

/**
 * Send a fax via SignalWire
 */
export async function sendFax(params: SendFaxParams): Promise<FaxResource> {
  const body = new URLSearchParams({
    To: params.to,
    From: params.from || FAX_NUMBER,
    MediaUrl: params.mediaUrl,
  });

  if (params.statusCallback) {
    body.set("StatusCallback", params.statusCallback);
  }

  const res = await fetch(`${BASE_URL}/Faxes`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`SignalWire send fax failed (${res.status}): ${errorText}`);
  }

  return res.json();
}

/**
 * Get fax status by SID
 */
export async function getFaxStatus(faxSid: string): Promise<FaxResource> {
  const res = await fetch(`${BASE_URL}/Faxes/${faxSid}`, {
    headers: { Authorization: authHeader() },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`SignalWire get fax failed (${res.status}): ${errorText}`);
  }

  return res.json();
}

/**
 * Cancel a queued/sending fax
 */
export async function cancelFax(faxSid: string): Promise<FaxResource> {
  const body = new URLSearchParams({ Status: "canceled" });

  const res = await fetch(`${BASE_URL}/Faxes/${faxSid}`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`SignalWire cancel fax failed (${res.status}): ${errorText}`);
  }

  return res.json();
}

/**
 * Download a fax media (received fax PDF)
 */
export async function downloadFaxMedia(mediaUrl: string): Promise<Buffer> {
  const res = await fetch(mediaUrl, {
    headers: { Authorization: authHeader() },
  });

  if (!res.ok) {
    throw new Error(`Failed to download fax media (${res.status})`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Normalize phone number to E.164 format
 */
export function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.startsWith("+")) return phone.replace(/[^\d+]/g, "");
  return `+${digits}`;
}

export { FAX_NUMBER };
