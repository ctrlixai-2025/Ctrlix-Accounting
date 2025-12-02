export enum Role {
  EMPLOYEE = 'EMPLOYEE',
  MANAGER = 'MANAGER',
}

export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export enum TransactionStatus {
  PENDING = 'PENDING',  // 待審核
  APPROVED = 'APPROVED', // 已審核
  BOOKED = 'BOOKED',    // 已入帳
}

export interface User {
  id: string;
  name: string;
  role: Role;
  avatar: string;
  password?: string; // Add password field
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  isActive: boolean;
}

export interface ProjectDept {
  id: string;
  name: string;
  isActive: boolean;
}

export interface PaymentMethod {
  id: string;
  name: string;
  isActive: boolean;
}

export interface Transaction {
  id: string;
  date: string; // ISO Date string
  type: TransactionType;
  amount: number;
  summary: string;
  attachmentUrl?: string; // Base64 or URL
  hasTaxId: boolean;
  paymentMethodId: string;
  categoryId: string;
  projectDeptId: string;
  recordedById: string;
  status: TransactionStatus;
  createdAt: number;
  
  // Optional fields for Synced Data Display
  categoryName?: string;
  projectName?: string;
  methodName?: string;
  recordedByName?: string;
}

// For Gemini AI Response
export interface ReceiptExtraction {
  amount?: number;
  date?: string;
  summary?: string;
  hasTaxId?: boolean;
}