export interface TORRequirement {
  id: string;
  property: string;
  category: 'technical' | 'experience' | 'certification' | 'financial';
  required: boolean;
  fulfilledBySoftwareHouse?: boolean;
}

export interface AIEvaluation {
  priceScore: number; // 0-100 score on budget fairness
  priceAssessment: string;
  qualificationMatchScore: number; // 0-100 match percentage
  riskLevel: 'Low' | 'Medium' | 'High';
  riskAnalysis: string;
  keyRequirementsExtracted: string[];
  aiModel: string;
  evaluatedAt: string;
}

export type StageCode = 'P0' | '15' | 'B0' | 'D0' | 'W0' | 'D1' | 'W1' | 'D2' | 'W2';

export interface StageObservation {
  title?: string | null;
  description?: string | null;
  publishedAt?: string | null;
  url?: string | null;
  documentUrl?: string | null;
  channelParams?: Record<string, unknown>;
  itemParams?: Record<string, unknown>;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  [key: string]: unknown;
}

export interface ProjectFields {
  scope: string;
  linkedProjectId: string | null;
  identityScope: 'project' | 'plan';
  statusPublishedAt: string | null;
  statusOrderAmbiguous: boolean;
  stageObservations: Partial<Record<StageCode, StageObservation>>;
  biddingOpenVerified: boolean;
  titleMatchedKeywords: string[];
  thumbnailSourceUrl: string | null;
  channelParams: Record<string, unknown>;
  itemParams: Record<string, unknown>;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
}

export interface TORContract extends Partial<ProjectFields> {
  id: string;
  projectId: string;
  sourceId?: string | null;
  title: string;
  contractOwner: string; // Publisher / Organization
  departmentId?: string | null;
  departmentName?: string | null;
  publisherType: 'BMA (กรุงเทพมหานคร)' | 'Ministry' | 'State Enterprise' | 'Public Organization' | string;
  price: number | null; // Project budget in THB; unknown is not zero.
  priceFormatted: string;
  startDate: string;
  endDate: string;
  postingDate: string;
  publishedAt?: string | null;
  submissionDeadline: string;
  category: 'e-Bidding (ประกวดราคาอิเล็กทรอนิกส์)' | 'Consulting (จ้างที่ปรึกษา)' | 'IT & Software (เทคโนโลยีและซอฟต์แวร์)' | 'General Services (จ้างเหมาบริการ)' | 'Specific Selection (วิธีเฉพาะเจาะจง)' | string;
  procurementMethod?: string | Record<string, unknown> | null;
  description: string;
  properties: TORRequirement[];
  pdfUrl: string;
  url?: string | null;
  documentUrl?: string | null;
  aiEvaluation: AIEvaluation;
  status: string; // RSS announcement stage.
  matchedScore?: number;
  thumbnail?: string;
}

export interface SoftwareHouseProfile {
  id: string;
  companyId?: string | null;
  role?: string;
  name: string;
  email: string;
  companyName: string;
  taxId: string;
  avatar: string;
  companySize: string;
  district: string;
  properties: string[]; // List of company qualifications / capabilities
  technologies: string[];
  certifications: string[];
  minPreferredBudget: number;
  maxPreferredBudget: number;
  notificationsEnabled: boolean;
  matchedTORIds: string[];
}

export interface FilterState {
  searchQuery: string;
  department: string;
  status: string;
  procurementMethod: string;
  datePreset: string;
  fromDate: string;
  toDate: string;
  stageScope: 'latest' | 'retained';
  sort: 'latest' | 'oldest' | 'relevance';
}
