import type { InviteLocale } from "@/lib/types";

export const GUEST_CSV_HEADERS = ["name", "phone", "plus_one", "locale"] as const;

export const GUEST_CSV_TEMPLATE = `name,phone,plus_one,locale
John Doe,+628123456789,no,id
`;

export type GuestCsvParsedRow = {
  row: number;
  guestName: string;
  guestPhone: string;
  locale: InviteLocale;
  allowPlusOne: boolean;
};

export type GuestCsvRowError = {
  row: number;
  message: string;
};

const HEADER_ALIASES: Record<(typeof GUEST_CSV_HEADERS)[number], string[]> = {
  name: ["name", "guest_name", "guest name"],
  phone: ["phone", "guest_phone", "guest phone"],
  plus_one: ["plus_one", "plus-one", "plus one", "allow_plus_one"],
  locale: ["locale"],
};

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };

  const pushRow = () => {
    if (row.length === 1 && row[0] === "" && rows.length > 0) return;
    rows.push(row);
    row = [];
  };

  const input = stripBom(text);
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      pushField();
    } else if (ch === "\r") {
      // ignore
    } else if (ch === "\n") {
      pushField();
      pushRow();
    } else {
      field += ch;
    }
  }

  pushField();
  if (row.length > 0 || field.length > 0) {
    pushRow();
  }

  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function resolveHeaderIndex(headers: string[]): Record<(typeof GUEST_CSV_HEADERS)[number], number> {
  const normalized = headers.map(normalizeHeader);
  const index: Partial<Record<(typeof GUEST_CSV_HEADERS)[number], number>> = {};

  for (const key of GUEST_CSV_HEADERS) {
    const aliases = HEADER_ALIASES[key];
    const idx = normalized.findIndex((h) => aliases.includes(h));
    if (idx >= 0) index[key] = idx;
  }

  if (index.name === undefined || index.phone === undefined) {
    throw new Error("MISSING_HEADERS");
  }

  return index as Record<(typeof GUEST_CSV_HEADERS)[number], number>;
}

function parsePlusOne(raw: string | undefined): { ok: true; value: boolean } | { ok: false } {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return { ok: true, value: false };
  if (["yes", "y", "true", "1"].includes(v)) return { ok: true, value: true };
  if (["no", "n", "false", "0"].includes(v)) return { ok: true, value: false };
  return { ok: false };
}

function parseLocale(raw: string | undefined): { ok: true; value: InviteLocale } | { ok: false } {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v || v === "id") return { ok: true, value: "id" };
  if (v === "en") return { ok: true, value: "en" };
  return { ok: false };
}

export function guestIdentityKey(name: string, phone: string): string {
  return `${name.trim().toLowerCase()}\0${phone.trim()}`;
}

export function parseGuestCsv(text: string): {
  rows: GuestCsvParsedRow[];
  errors: GuestCsvRowError[];
} {
  const matrix = parseCsv(text);
  if (matrix.length === 0) {
    return { rows: [], errors: [{ row: 0, message: "CSV file is empty" }] };
  }

  let headerIndex: Record<(typeof GUEST_CSV_HEADERS)[number], number>;
  try {
    headerIndex = resolveHeaderIndex(matrix[0]);
  } catch {
    return {
      rows: [],
      errors: [
        {
          row: 1,
          message: "Missing required columns. Expected at least: name, phone",
        },
      ],
    };
  }

  const rows: GuestCsvParsedRow[] = [];
  const errors: GuestCsvRowError[] = [];

  for (let i = 1; i < matrix.length; i++) {
    const cells = matrix[i];
    const rowNumber = i + 1;
    const name = (cells[headerIndex.name] ?? "").trim();
    const phone = (cells[headerIndex.phone] ?? "").trim();
    const plusOneRaw = headerIndex.plus_one !== undefined ? cells[headerIndex.plus_one] : "";
    const localeRaw = headerIndex.locale !== undefined ? cells[headerIndex.locale] : "";

    if (!name && !phone && !(plusOneRaw ?? "").trim() && !(localeRaw ?? "").trim()) {
      continue;
    }

    if (!name) {
      errors.push({ row: rowNumber, message: "Name is required" });
      continue;
    }
    if (!phone) {
      errors.push({ row: rowNumber, message: "Phone is required" });
      continue;
    }

    const plusOne = parsePlusOne(plusOneRaw);
    if (!plusOne.ok) {
      errors.push({
        row: rowNumber,
        message: "Invalid plus_one value (use yes/no, true/false, or 1/0)",
      });
      continue;
    }

    const locale = parseLocale(localeRaw);
    if (!locale.ok) {
      errors.push({ row: rowNumber, message: "Invalid locale (use id or en)" });
      continue;
    }

    rows.push({
      row: rowNumber,
      guestName: name,
      guestPhone: phone,
      locale: locale.value,
      allowPlusOne: plusOne.value,
    });
  }

  return { rows, errors };
}

export function downloadGuestCsvTemplate(): void {
  const blob = new Blob([GUEST_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "guests-template.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}
