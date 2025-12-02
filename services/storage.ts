import { Category, PaymentMethod, ProjectDept, Role, Transaction, User } from "../types";
import { INITIAL_CATEGORIES, INITIAL_PAYMENT_METHODS, INITIAL_PROJECTS, INITIAL_TRANSACTIONS } from "../constants";

const KEYS = {
  TRANSACTIONS: 'ib_transactions',
  CATEGORIES: 'ib_categories',
  PROJECTS: 'ib_projects',
  PAYMENT_METHODS: 'ib_payment_methods',
  USER: 'ib_current_user',
  USERS_LIST: 'ib_users_list', // New key for storing all users
  GOOGLE_SCRIPT_URL: 'ib_google_script_url'
};

// Helper to initialize storage if empty
const initStorage = () => {
  if (!localStorage.getItem(KEYS.TRANSACTIONS)) localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(INITIAL_TRANSACTIONS));
  if (!localStorage.getItem(KEYS.CATEGORIES)) localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(INITIAL_CATEGORIES));
  if (!localStorage.getItem(KEYS.PROJECTS)) localStorage.setItem(KEYS.PROJECTS, JSON.stringify(INITIAL_PROJECTS));
  if (!localStorage.getItem(KEYS.PAYMENT_METHODS)) localStorage.setItem(KEYS.PAYMENT_METHODS, JSON.stringify(INITIAL_PAYMENT_METHODS));
  
  // Initialize Default Admin if no users exist
  if (!localStorage.getItem(KEYS.USERS_LIST)) {
    const defaultAdmin: User = {
      id: 'admin',
      name: '系統管理員',
      role: Role.MANAGER,
      avatar: 'https://ui-avatars.com/api/?name=Admin&background=0D8ABC&color=fff',
      password: 'admin888'
    };
    localStorage.setItem(KEYS.USERS_LIST, JSON.stringify([defaultAdmin]));
  }
};

initStorage();

export const storageService = {
  // Current Session User
  setCurrentUser: (user: User | null) => {
    if (user) localStorage.setItem(KEYS.USER, JSON.stringify(user));
    else localStorage.removeItem(KEYS.USER);
  },
  getCurrentUser: (): User | null => {
    const u = localStorage.getItem(KEYS.USER);
    return u ? JSON.parse(u) : null;
  },

  // User Management (CRUD)
  getUsers: (): User[] => {
    return JSON.parse(localStorage.getItem(KEYS.USERS_LIST) || '[]');
  },
  saveUser: (user: User) => {
    const users = storageService.getUsers();
    const index = users.findIndex(u => u.id === user.id);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    localStorage.setItem(KEYS.USERS_LIST, JSON.stringify(users));
  },
  updateUsersList: (users: User[]) => {
    if (users && users.length > 0) {
      localStorage.setItem(KEYS.USERS_LIST, JSON.stringify(users));
    }
  },
  deleteUser: (id: string) => {
    const users = storageService.getUsers().filter(u => u.id !== id);
    localStorage.setItem(KEYS.USERS_LIST, JSON.stringify(users));
  },

  // Transactions
  getTransactions: (): Transaction[] => {
    return JSON.parse(localStorage.getItem(KEYS.TRANSACTIONS) || '[]');
  },
  saveTransaction: (tx: Transaction) => {
    const list = storageService.getTransactions();
    const index = list.findIndex(t => t.id === tx.id);
    if (index >= 0) {
      list[index] = tx;
    } else {
      list.push(tx);
    }
    localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(list));
  },
  
  // Merge transactions fetched from Google Sheets
  mergeTransactions: (cloudTxs: Transaction[]) => {
    const localTxs = storageService.getTransactions();
    
    cloudTxs.forEach(cloudTx => {
      const index = localTxs.findIndex(t => t.id === cloudTx.id);
      if (index >= 0) {
        // Update existing transaction with cloud status/data
        // We preserve local attachmentUrl if cloud doesn't have it (since sheet usually doesn't store base64)
        localTxs[index] = {
          ...localTxs[index],
          status: cloudTx.status, // Priority: Cloud Status
          // Optional: Update other fields if cloud is source of truth
          categoryName: cloudTx.categoryName,
          projectName: cloudTx.projectName,
          recordedByName: cloudTx.recordedByName,
        };
      } else {
        // New transaction found in cloud (e.g. added by manager or other device?)
        // Add it to local
        localTxs.push(cloudTx);
      }
    });
    
    localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(localTxs));
    return localTxs;
  },

  deleteTransaction: (id: string) => {
    const list = storageService.getTransactions().filter(t => t.id !== id);
    localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(list));
  },

  // Metadata Lists
  getCategories: (): Category[] => JSON.parse(localStorage.getItem(KEYS.CATEGORIES) || '[]'),
  saveCategories: (list: Category[]) => localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(list)),

  getProjects: (): ProjectDept[] => JSON.parse(localStorage.getItem(KEYS.PROJECTS) || '[]'),
  saveProjects: (list: ProjectDept[]) => localStorage.setItem(KEYS.PROJECTS, JSON.stringify(list)),

  getPaymentMethods: (): PaymentMethod[] => JSON.parse(localStorage.getItem(KEYS.PAYMENT_METHODS) || '[]'),
  savePaymentMethods: (list: PaymentMethod[]) => localStorage.setItem(KEYS.PAYMENT_METHODS, JSON.stringify(list)),

  // Settings
  getGoogleScriptUrl: (): string => localStorage.getItem(KEYS.GOOGLE_SCRIPT_URL) || '',
  saveGoogleScriptUrl: (url: string) => localStorage.setItem(KEYS.GOOGLE_SCRIPT_URL, url),
};