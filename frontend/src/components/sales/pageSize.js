/**
 * Page size defaults shared by every paged list outside the Repair Tracker:
 * the sales lists, Users & Accounts, and the Workspace's tasks, bills,
 * payments, P&L, journal and people timeline. 100 is there for the long
 * reads (a month's journal, a year's P&L) the tracker's tables already allow.
 */
export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];
