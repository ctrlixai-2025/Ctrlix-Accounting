import { Category, PaymentMethod, ProjectDept, Role, Transaction, TransactionStatus, User } from "../types";
import { INITIAL_CATEGORIES, INITIAL_PAYMENT_METHODS, INITIAL_PROJECTS, INITIAL_TRANSACTIONS } from "../constants";

const KEYS = {
  TRANSACTIONS: 'ib_transactions',
  CATEGORIES: 'ib_categories',
  PROJECTS: 'ib_projects',
  PAYMENT_METHODS: 'ib_payment_methods',
  USER: 'ib_current_user',
  USERS_LIST: 'ib_users_list',
  GOOGLE_SCRIPT_URL: 'ib_google_script_url'
};

const initStorage = () => {
  if (!localStorage.getItem(KEYS.TRANSACTIONS)) localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(INITIAL_TRANSACTIONS));
  if (!localStorage.getItem(KEYS.CATEGORIES)) localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(INITIAL_CATEGORIES));
  if (!localStorage.getItem(KEYS.PROJECTS)) localStorage.setItem(KEYS.PROJECTS, JSON.stringify(INITIAL_PROJECTS));
  if (!localStorage.getItem(KEYS.PAYMENT_METHODS)) localStorage.setItem(KEYS.PAYMENT_METHODS, JSON.stringify(INITIAL_PAYMENT_METHODS));
  
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
  setCurrentUser: (user: User | null) => {
    if (user) localStorage.setItem(KEYS.USER, JSON.stringify(user));
    else localStorage.removeItem(KEYS.USER);
  },
  getCurrentUser: (): User | null => {
    const u = localStorage.getItem(KEYS.USER);
    return u ? JSON.parse(u) : null;
  },

  getUsers: (): User[] => JSON.parse(localStorage.getItem(KEYS.USERS_LIST) || '[]'),
  saveUser: (user: User) => {
    const users = storageService.getUsers();
    const index = users.findIndex(u => u.id === user.id);
    if (index >= 0) users[index] = user;
    else users.push(user);
    localStorage.setItem(KEYS.USERS_LIST, JSON.stringify(users));
  },
  updateUsersList: (users: User[]) => {
    if (users && users.length > 0) localStorage.setItem(KEYS.USERS_LIST, JSON.stringify(users));
  },
  deleteUser: (id: string) => {
    const users = storageService.getUsers().filter(u => u.id !== id);
    localStorage.setItem(KEYS.USERS_LIST, JSON.stringify(users));
  },

  getTransactions: (): Transaction[] => JSON.parse(localStorage.getItem(KEYS.TRANSACTIONS) || '[]'),
  saveTransaction: (tx: Transaction) => {
    const list = storageService.getTransactions();
    const index = list.findIndex(t => t.id === tx.id);
    if (index >= 0) list[index] = tx;
    else list.push(tx);
    localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(list));
  },
  mergeTransactions: (cloudTxs: Transaction[]) => {
    const localTxs = storageService.getTransactions();
    cloudTxs.forEach(cloudTx => {
      let normalizedStatus = TransactionStatus.PENDING;
      // Handle both Chinese and English status from Sheet
      const statusStr = (cloudTx.status || '').toString().toUpperCase();

      if (statusStr === 'APPROVED' || statusStr === '已審核') normalizedStatus = TransactionStatus.APPROVED;
      else if (statusStr === 'BOOKED' || statusStr === '已入帳') normalizedStatus = TransactionStatus.BOOKED;
      else normalizedStatus = TransactionStatus.PENDING;

      const index = localTxs.findIndex(t => t.id === cloudTx.id);
      if (index >= 0) {
        localTxs[index] = {
          ...localTxs[index],
          status: normalizedStatus, 
          // Update display names if provided by cloud (though currently we primarily sync status)
          categoryName: cloudTx.categoryName || localTxs[index].categoryName,
          projectName: cloudTx.projectName || localTxs[index].projectName,
          recordedByName: cloudTx.recordedByName || localTxs[index].recordedByName,
        };
      } else {
        // If it exists in cloud but not local (rare in this offline-first flow, but possible if user cleared storage)
        // We add it, but note that we might miss some details if cloud doesn't send everything back.
        // For status sync, we mostly care about updating existing ones.
        localTxs.push({ ...cloudTx, status: normalizedStatus });
      }
    });
    localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(localTxs));
    return localTxs;
  },
  deleteTransaction: (id: string) => {
    const list = storageService.getTransactions().filter(t => t.id !== id);
    localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(list));
  },

  getCategories: (): Category[] => JSON.parse(localStorage.getItem(KEYS.CATEGORIES) || '[]'),
  saveCategories: (list: Category[]) => localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(list)),
  updateCategoriesList: (list: Category[]) => {
    if (list && list.length > 0) localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(list));
  },

  getProjects: (): ProjectDept[] => JSON.parse(localStorage.getItem(KEYS.PROJECTS) || '[]'),
  saveProjects: (list: ProjectDept[]) => localStorage.setItem(KEYS.PROJECTS, JSON.stringify(list)),
  updateProjectsList: (list: ProjectDept[]) => {
    if (list && list.length > 0) localStorage.setItem(KEYS.PROJECTS, JSON.stringify(list));
  },

  getPaymentMethods: (): PaymentMethod[] => JSON.parse(localStorage.getItem(KEYS.PAYMENT_METHODS) || '[]'),
  savePaymentMethods: (list: PaymentMethod[]) => localStorage.setItem(KEYS.PAYMENT_METHODS, JSON.stringify(list)),

  getGoogleScriptUrl: (): string => localStorage.getItem(KEYS.GOOGLE_SCRIPT_URL) || '',
  saveGoogleScriptUrl: (url: string) => localStorage.setItem(KEYS.GOOGLE_SCRIPT_URL, url),
};
