/**
 * Which component draws each route, and its header title.
 *
 * Every route in `core/routes.ts` must appear here (TypeScript enforces it).
 * Titles go through `t()` when the navigator renders them.
 */

import type { ComponentType } from 'react';

import type { ScreenRoute } from '../core/routes';
import { HomeScreen } from '../screens/home/HomeScreen';
import { ServicesScreen } from '../screens/home/ServicesScreen';
import { PunchHistoryScreen, PunchScreen } from '../screens/time/PunchScreens';
import { VisitsScreen } from '../screens/time/VisitScreens';
import { PayslipDetailScreen, PayslipsScreen, SalaryScreen, TotalRewardsScreen } from '../screens/me/PayScreens';
import { AdvancesScreen, ExpenseDetailScreen, ExpensesScreen, NewExpenseScreen, TravelRequestsScreen } from '../screens/me/ExpenseScreens';
import { HelpdeskScreen, NewTicketScreen, TicketDetailScreen } from '../screens/me/HelpdeskScreens';
import { AssetsScreen, RequestAssetScreen } from '../screens/me/AssetScreens';
import { CompanyPoliciesScreen, DocumentsScreen, LetterDetailScreen, LettersScreen } from '../screens/me/DocumentScreens';
import {
  AppraisalScreen,
  CourseDetailScreen,
  FeedbackScreen,
  GiveFeedbackScreen,
  GoalDetailScreen,
  GoalsScreen,
  GrowthScreen,
  LearningScreen,
  OneOnOneDetailScreen,
  OneOnOnesScreen,
  ReviewDetailScreen,
  SelfReviewScreen,
} from '../screens/me/GrowthScreens';
import {
  AwardsScreen,
  ClubDetailScreen,
  ClubsScreen,
  CultureScreen,
  EventsScreen,
  GiveShoutoutScreen,
  PollsScreen,
  ShoutoutsScreen,
  SurveyDetailScreen,
  SurveysScreen,
} from '../screens/me/CultureScreens';
import {
  ExitScreen,
  InterviewDetailScreen,
  InterviewsScreen,
  OnboardingScreen,
  ReferScreen,
  ReferralsScreen,
  ResignScreen,
  RewardsScreen,
} from '../screens/me/CareerScreens';
import { ApplyLoanScreen, BenefitsScreen, EsopScreen, EwaScreen, FlexiScreen, LoansScreen } from '../screens/me/PerksScreens';
import { Form16Screen, TaxDeclarationsScreen, TaxRegimeScreen, TaxScreen } from '../screens/me/TaxScreens';
import { ChangeRequestsScreen, ColleagueScreen, OrgChartScreen, ProfileEditScreen, ProfileScreen } from '../screens/me/ProfileScreens';
import { AnnouncementsScreen, CelebrationsScreen, QuickLinksScreen, WhoIsOutScreen } from '../screens/home/HomeMoreScreens';
import { ApprovalDetailScreen, InboxScreen } from '../screens/inbox/InboxScreens';
import { ApplyLeaveScreen, LeaveDetailScreen, LeaveHistoryScreen, LeaveScreen } from '../screens/time/LeaveScreens';
import { AttendanceDetailScreen, AttendanceScreen, RegularisationsScreen, RegulariseScreen } from '../screens/time/AttendanceScreens';
import {
  CompOffScreen,
  HolidaysScreen,
  NewCompOffScreen,
  OptionalHolidaysScreen,
  OvertimeScreen,
  ShiftSwapScreen,
  ShiftsScreen,
  TimesheetScreen,
} from '../screens/time/TimeMoreScreens';
import { AskMiraScreen } from '../screens/mira/AskMiraScreen';
import { MiraHistoryScreen } from '../screens/mira/MiraHistoryScreen';
import { AiTransparencyScreen, ConsentScreen, DataRequestsScreen, PrivacyScreen } from '../screens/me/privacy/PrivacyScreens';
import { MeHubScreen } from '../screens/me/MeHubScreen';
import { NotificationPrefsScreen, SecurityScreen, SettingsScreen } from '../screens/me/AccountScreens';
import { MyTeamScreen, TeamMemberScreen } from '../screens/me/TeamScreens';

export interface ScreenEntry {
  component: ComponentType<object>;
  title: string;
  /** false hides the stack header (the screen draws its own title). */
  header?: boolean;
}

export const SCREENS: Record<ScreenRoute, ScreenEntry> = {
  // Home tab
  Home: { component: HomeScreen, title: 'Home', header: false },
  Services: { component: ServicesScreen, title: 'All services' },
  Announcements: { component: AnnouncementsScreen, title: 'Announcements' },
  Celebrations: { component: CelebrationsScreen, title: 'Celebrations' },
  WhoIsOut: { component: WhoIsOutScreen, title: "Who's out" },
  Holidays: { component: HolidaysScreen, title: 'Holidays' },
  QuickLinks: { component: QuickLinksScreen, title: 'Company links' },

  // Attendance tab
  Attendance: { component: AttendanceScreen, title: 'Attendance', header: false },
  Punch: { component: PunchScreen, title: 'Punch' },
  PunchHistory: { component: PunchHistoryScreen, title: 'Punch history' },
  Visits: { component: VisitsScreen, title: 'Client visits' },
  AttendanceDetail: { component: AttendanceDetailScreen, title: 'Day' },
  Regularisations: { component: RegularisationsScreen, title: 'My corrections' },
  // Leave tab
  Leave: { component: LeaveScreen, title: 'Leave', header: false },
  LeaveDetail: { component: LeaveDetailScreen, title: 'Leave request' },
  LeaveHistory: { component: LeaveHistoryScreen, title: 'My leave requests' },
  CompOff: { component: CompOffScreen, title: 'Comp-off' },
  OptionalHolidays: { component: OptionalHolidaysScreen, title: 'Optional holidays' },
  Shifts: { component: ShiftsScreen, title: 'Shifts' },
  Overtime: { component: OvertimeScreen, title: 'Overtime' },
  Timesheet: { component: TimesheetScreen, title: 'Timesheet' },

  // Over the tabs, from the bell
  Inbox: { component: InboxScreen, title: 'Inbox' },
  ApprovalDetail: { component: ApprovalDetailScreen, title: 'Approval' },

  // Me tab
  MeHub: { component: MeHubScreen, title: 'Me', header: false },
  Profile: { component: ProfileScreen, title: 'Profile' },
  ProfileEdit: { component: ProfileEditScreen, title: 'Edit details' },
  ChangeRequests: { component: ChangeRequestsScreen, title: 'Change requests' },
  OrgChart: { component: OrgChartScreen, title: 'My team & manager' },
  Colleague: { component: ColleagueScreen, title: 'Colleague' },
  Payslips: { component: PayslipsScreen, title: 'Payslips' },
  PayslipDetail: { component: PayslipDetailScreen, title: 'Payslip' },
  Salary: { component: SalaryScreen, title: 'Salary structure' },
  TotalRewards: { component: TotalRewardsScreen, title: 'Total rewards' },
  Tax: { component: TaxScreen, title: 'Tax' },
  TaxRegime: { component: TaxRegimeScreen, title: 'Tax regime' },
  TaxDeclarations: { component: TaxDeclarationsScreen, title: 'Declarations' },
  Form16: { component: Form16Screen, title: 'Form 16' },
  Loans: { component: LoansScreen, title: 'Loans & advances' },
  Flexi: { component: FlexiScreen, title: 'Flexi benefits' },
  Ewa: { component: EwaScreen, title: 'Early pay' },
  Benefits: { component: BenefitsScreen, title: 'Benefits' },
  Esop: { component: EsopScreen, title: 'Stock options' },
  Expenses: { component: ExpensesScreen, title: 'Expenses' },
  ExpenseDetail: { component: ExpenseDetailScreen, title: 'Expense claim' },
  Advances: { component: AdvancesScreen, title: 'Advances' },
  TravelRequests: { component: TravelRequestsScreen, title: 'Travel requests' },
  Helpdesk: { component: HelpdeskScreen, title: 'Helpdesk' },
  TicketDetail: { component: TicketDetailScreen, title: 'Ticket' },
  Documents: { component: DocumentsScreen, title: 'Documents' },
  CompanyPolicies: { component: CompanyPoliciesScreen, title: 'Company policies' },
  Letters: { component: LettersScreen, title: 'Letters' },
  LetterDetail: { component: LetterDetailScreen, title: 'Letter' },
  Assets: { component: AssetsScreen, title: 'My assets' },
  Growth: { component: GrowthScreen, title: 'Growth' },
  Goals: { component: GoalsScreen, title: 'Goals' },
  GoalDetail: { component: GoalDetailScreen, title: 'Goal' },
  OneOnOnes: { component: OneOnOnesScreen, title: '1:1s' },
  OneOnOneDetail: { component: OneOnOneDetailScreen, title: '1:1' },
  Feedback: { component: FeedbackScreen, title: 'Feedback' },
  Appraisal: { component: AppraisalScreen, title: 'My reviews' },
  ReviewDetail: { component: ReviewDetailScreen, title: 'Review' },
  Learning: { component: LearningScreen, title: 'Learning' },
  CourseDetail: { component: CourseDetailScreen, title: 'Course' },
  Culture: { component: CultureScreen, title: 'Culture' },
  Shoutouts: { component: ShoutoutsScreen, title: 'Shoutouts' },
  Clubs: { component: ClubsScreen, title: 'Clubs' },
  ClubDetail: { component: ClubDetailScreen, title: 'Club' },
  Polls: { component: PollsScreen, title: 'Polls' },
  Events: { component: EventsScreen, title: 'Events' },
  Surveys: { component: SurveysScreen, title: 'Surveys' },
  Awards: { component: AwardsScreen, title: 'Awards' },
  Rewards: { component: RewardsScreen, title: 'Reward points' },
  Referrals: { component: ReferralsScreen, title: 'Refer a friend' },
  Interviews: { component: InterviewsScreen, title: 'My interviews' },
  InterviewDetail: { component: InterviewDetailScreen, title: 'Interview' },
  Onboarding: { component: OnboardingScreen, title: 'My onboarding' },
  Exit: { component: ExitScreen, title: 'Resignation' },
  Privacy: { component: PrivacyScreen, title: 'Privacy' },
  Consent: { component: ConsentScreen, title: 'Consent' },
  DataRequests: { component: DataRequestsScreen, title: 'My data requests' },
  AiTransparency: { component: AiTransparencyScreen, title: 'AI and my record' },
  Security: { component: SecurityScreen, title: 'Security' },
  Settings: { component: SettingsScreen, title: 'Settings' },
  NotificationPrefs: { component: NotificationPrefsScreen, title: 'Notifications' },
  MyTeam: { component: MyTeamScreen, title: 'My team' },
  TeamMember: { component: TeamMemberScreen, title: 'Team member' },

  // Modals
  AskMira: { component: AskMiraScreen, title: 'Ask Miraa', header: false },
  MiraHistory: { component: MiraHistoryScreen, title: 'Conversations' },
  ApplyLeave: { component: ApplyLeaveScreen, title: 'Apply leave' },
  Regularise: { component: RegulariseScreen, title: 'Regularise attendance' },
  NewCompOff: { component: NewCompOffScreen, title: 'Claim comp-off' },
  NewExpense: { component: NewExpenseScreen, title: 'New expense' },
  NewTicket: { component: NewTicketScreen, title: 'Raise a ticket' },
  GiveShoutout: { component: GiveShoutoutScreen, title: 'Give a shoutout' },
  Resign: { component: ResignScreen, title: 'Resign' },
  RequestAsset: { component: RequestAssetScreen, title: 'Request an asset' },
  Refer: { component: ReferScreen, title: 'Refer a candidate' },
  ApplyLoan: { component: ApplyLoanScreen, title: 'Apply for a loan' },
  ShiftSwap: { component: ShiftSwapScreen, title: 'Swap a shift' },
  SelfReview: { component: SelfReviewScreen, title: 'Review' },
  GiveFeedback: { component: GiveFeedbackScreen, title: 'Give feedback' },
  SurveyDetail: { component: SurveyDetailScreen, title: 'Survey' },
};
