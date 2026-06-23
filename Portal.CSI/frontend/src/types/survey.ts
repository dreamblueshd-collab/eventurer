export interface SurveyOverviewItem {
  SurveyId: number;
  EventId?: number;
  EventTitle?: string | null;
  Title: string;
  StartDate?: string | null;
  EndDate?: string | null;
  Status: "Draft" | "Active" | "Closed" | "Archived" | string;
  AssignedAdminName?: string | null;
  AssignedAdminNames?: string[];
  AssignedAdminUsernames?: string[];
  AssignedAdminIds?: number[];
  TargetRespondents?: number | null;
  TargetScore?: number | null;
  CurrentScore?: number | null;
  RespondentCount?: number;
  SurveyCount?: number;
  HasGeneratedReport?: boolean;
  UpdatedAt?: string | null;
  CreatedAt?: string | null;
}

export interface SurveysResponse {
  success: boolean;
  surveys: SurveyOverviewItem[];
  message?: string;
  error?: string;
}

export interface SurveyConfiguration {
  ConfigId?: number;
  HeroTitle?: string | null;
  HeroSubtitle?: string | null;
  HeroImageUrl?: string | null;
  LogoUrl?: string | null;
  BackgroundColor?: string | null;
  BackgroundImageUrl?: string | null;
  PrimaryColor?: string | null;
  SecondaryColor?: string | null;
  FontFamily?: string | null;
  ButtonStyle?: string | null;
  ShowProgressBar?: boolean;
  ShowPageNumbers?: boolean;
  MultiPage?: boolean;
  HeroImagePositionX?: number | null;
  HeroImagePositionY?: number | null;
  LogoPositionX?: number | null;
  LogoPositionY?: number | null;
  BackgroundPositionX?: number | null;
  BackgroundPositionY?: number | null;
}

export interface SurveyQuestion {
  QuestionId: number;
  SurveyId: number;
  Type: string;
  PromptText: string;
  Subtitle?: string | null;
  ImageUrl?: string | null;
  IsMandatory?: boolean;
  DisplayOrder?: number;
  PageNumber?: number;
  LayoutOrientation?: "vertical" | "horizontal" | string;
  Options?: unknown;
}

export interface SurveyDetail extends SurveyOverviewItem {
  Description?: string | null;
  AssignedAdminId?: number | null;
  SurveyLink?: string | null;
  ShortenedLink?: string | null;
  QRCodeDataUrl?: string | null;
  EmbedCode?: string | null;
  DuplicatePreventionEnabled?: boolean;
  RequireApproval?: boolean;
  configuration?: SurveyConfiguration;
  questions?: SurveyQuestion[];
}
