export type PublisherApplicationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "withdrawn"
  | "expired";

export type PublisherApplication = {
  id: string;
  applicantUid: string;
  publisherName: string;
  legalRepresentativeName: string;
  independentPublisher: boolean;
  publisherEmail: string;
  website?: string;
  status: PublisherApplicationStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  revokedAt?: string;
  expiresAt: string;
  reviewerUid?: string;
  decisionReason?: string;
  revision: number;
};

export type CreatePublisherApplicationDto = {
  publisherName: string;
  legalRepresentativeName: string;
  independentPublisher: boolean;
  publisherEmail: string;
  website?: string;
};

export type ReviewPublisherApplicationDto = {
  decisionReason: string;
};
