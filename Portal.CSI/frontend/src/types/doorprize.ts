// TypeScript types for the Doorprize module.
// Mirrors the backend doorprize service contracts (DoorprizeEvents,
// DoorprizeGifts, DoorprizeParticipants, DoorprizeResults) and the draw /
// import flows. All datetime values are serialized as ISO 8601 strings.

export type DoorprizeEventStatus =
  | "Draft"
  | "Active"
  | "Completed"
  | "Archived";

export interface DoorprizeEvent {
  doorprizeEventId: number;
  name: string;
  eventDate: string; // ISO datetime
  imagePath: string | null;
  imageUrl: string | null;
  status: DoorprizeEventStatus;
  createdBy: number;
  createdAt: string;
  updatedAt: string | null;
  parentEventId: number | null;
  // Computed
  giftCount?: number;
  participantCount?: number;
  resultCount?: number;
}

export interface DoorprizeGift {
  doorprizeGiftId: number;
  doorprizeEventId: number;
  name: string;
  quota: number;
  giftBy: string | null;
  drawTime: string | null;
  imagePath: string | null;
  imageUrl: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string | null;
  // Computed
  resultCount?: number;
  quotaRemaining?: number;
}

export interface DoorprizeParticipant {
  doorprizeParticipantId: number;
  doorprizeEventId: number;
  employeeCode: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  unit: string | null;
  isActive: boolean;
  imagePath: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
  // Computed
  hasWon?: boolean;
}

export interface DoorprizeResult {
  doorprizeResultId: number;
  doorprizeEventId: number;
  doorprizeGiftId: number;
  doorprizeParticipantId: number;
  drawnAt: string;
  drawnBy: number;
  // Joined
  participant?: DoorprizeParticipant;
  gift?: DoorprizeGift;
}

export interface DrawState {
  event: DoorprizeEvent;
  gifts: (DoorprizeGift & { quotaRemaining: number })[];
  eligibleParticipants: DoorprizeParticipant[];
  results: DoorprizeResult[];
}

export interface DrawRequest {
  giftId: number;
}

export interface DrawResponse {
  result: DoorprizeResult;
  winner: DoorprizeParticipant;
  gift: DoorprizeGift;
}

export interface ImportResult {
  totalRows: number;
  imported: number;
  skipped: number;
  errors: { row: number; message: string }[];
}
