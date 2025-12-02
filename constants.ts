import { Category, PaymentMethod, ProjectDept, Transaction, TransactionStatus, TransactionType } from "./types";

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'c1', name: '營業收入', type: TransactionType.INCOME, isActive: true },
  { id: 'c2', name: '辦公室租金', type: TransactionType.EXPENSE, isActive: true },
  { id: 'c3', name: '員工伙食', type: TransactionType.EXPENSE, isActive: true },
  { id: 'c4', name: '交通差旅', type: TransactionType.EXPENSE, isActive: true },
  { id: 'c5', name: '設備採購', type: TransactionType.EXPENSE, isActive: true },
];

export const INITIAL_PROJECTS: ProjectDept[] = [
  { id: 'p1', name: '行政部', isActive: true },
  { id: 'p2', name: '業務部', isActive: true },
  { id: 'p3', name: '專案 A - 網站改版', isActive: true },
];

export const INITIAL_PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'pm1', name: '公司銀行帳戶', isActive: true },
  { id: 'pm2', name: '公司信用卡', isActive: true },
  { id: 'pm3', name: '員工代墊 (現金)', isActive: true },
];

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 't1',
    date: '2023-10-01',
    type: TransactionType.EXPENSE,
    amount: 1200,
    summary: '午餐會議',
    paymentMethodId: 'pm3',
    categoryId: 'c3',
    projectDeptId: 'p2',
    recordedById: 'u1',
    status: TransactionStatus.PENDING,
    hasTaxId: true,
    createdAt: 1696156800000
  },
  {
    id: 't2',
    date: '2023-10-02',
    type: TransactionType.EXPENSE,
    amount: 25000,
    summary: '新進人員筆電',
    paymentMethodId: 'pm2',
    categoryId: 'c5',
    projectDeptId: 'p1',
    recordedById: 'u2',
    status: TransactionStatus.APPROVED,
    hasTaxId: true,
    createdAt: 1696243200000
  },
  {
    id: 't3',
    date: '2023-10-05',
    type: TransactionType.INCOME,
    amount: 150000,
    summary: '專案 A 第一期款',
    paymentMethodId: 'pm1',
    categoryId: 'c1',
    projectDeptId: 'p3',
    recordedById: 'u2',
    status: TransactionStatus.BOOKED,
    hasTaxId: false,
    createdAt: 1696502400000
  }
];