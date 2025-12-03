import { Category, PaymentMethod, ProjectDept, Role, Transaction, TransactionStatus, TransactionType } from "../types";
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
  // 1. Transactions
  if (!localStorage.getItem(KEYS.TRANSACTIONS)) {
    localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(INITIAL_TRANSACTIONS));
  } else {
    // Auto-cleanup legacy mock data (t1, t2, t3) if they exist
    try {
      const existing = JSON.parse(localStorage.getItem(KEYS.TRANSACTIONS) || '[]');
      const filtered = existing.filter((t: Transaction) => !['t1', 't2', 't3'].includes(t.id));
      if (filtered.length !== existing.length) {
        localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(filtered));
        console.log('Cleaned up legacy mock transactions');
      }
    } catch (e) {
      console.error('Error cleaning up transactions', e);
    }
  }

  // 2. Categories
  if (!localStorage.getItem(KEYS.CATEGORIES)) localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(INITIAL_CATEGORIES));
  
  // 3. Projects
  if (!localStorage.getItem(KEYS.PROJECTS)) localStorage.setItem(KEYS.PROJECTS, JSON.stringify(INITIAL_PROJECTS));
  
  // 4. Payment Methods
  if (!localStorage.getItem(KEYS.PAYMENT_METHODS)) localStorage.setItem(KEYS.PAYMENT_METHODS, JSON.stringify(INITIAL_PAYMENT_METHODS));
  
  // 5. Users List
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

// 輔助函式：將雲端狀態字串正規化為 TypeScript Enum
const normalizeStatus = (statusStr: any): TransactionStatus => {
    const s = (statusStr || '').toString().toUpperCase();
    if (s === 'APPROVED' || s === '已審核') return TransactionStatus.APPROVED;
    if (s === 'BOOKED' || s === '已入帳') return TransactionStatus.BOOKED;
    return TransactionStatus.PENDING;
};


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
    
  // 🚨 修正 1：新增核心數據轉換功能 (將雲端陣列數據轉為物件)
  /**
   * 將 GAS 回傳的原始二維陣列數據轉換為前端的 Transaction 物件陣列。
   * 這是解決跨瀏覽器不同步問題的最後一道防線。
   * @param headers 頂部欄位名稱 (目前未使用，但保留簽名)
   * @param data 數據內容 (不含標題列)
   */
  processCloudTransactions: (headers: string[], data: any[][]): Transaction[] => {
      // 根據 Code.gs 中 transactionRow 的欄位順序進行映射：
      // [0: ID, 1: 日期, 2: 類型, 3: 金額, 4: 摘要, 5: 類別名稱, 6: 專案名稱, 7: 方法名稱, 8: 有統編, 9: 填寫人, 10: 狀態, 11: 創建時間, 12: 附件 URL]
      const transactions: Transaction[] = data.map((row) => {
          
          // 確保行數據長度足夠，避免索引錯誤
          if (row.length < 12 || !row[0]) {
              // 忽略無效或不完整的行
              return null; 
          }
          
          return {
              id: String(row[0]),
              date: row[1] ? new Date(row[1]).toISOString().split('T')[0] : '', // 格式化日期
              type: String(row[2]) === 'INCOME' ? TransactionType.INCOME : TransactionType.EXPENSE,
              amount: Number(row[3]) || 0,
              summary: String(row[4] || ''),
              
              // 雲端數據的名稱，用於列表顯示
              categoryName: String(row[5] || 'Unknown'), 
              projectName: String(row[6] || 'Unknown'), 
              methodName: String(row[7] || 'Unknown'),
              
              hasTaxId: String(row[8]) === '是', // 雲端是中文 "是"/"否"
              recordedByName: String(row[9] || '未知'),
              status: normalizeStatus(row[10]), // 使用輔助函式正規化狀態
              
              createdAt: Number(row[11]) || Date.now(),
              attachmentUrl: String(row[12] || ''),
              
              // 💡 由於 GAS 只存名稱，我們假設 id 欄位使用 'synced' 或 'unknown' 作為 placeholder
              categoryId: 'synced', 
              projectDeptId: 'synced',
              paymentMethodId: 'synced',
              recordedById: 'unknown', 
          } as Transaction;
      }).filter((tx): tx is Transaction => tx !== null); // 過濾掉 null 且確保類型正確

      return transactions;
  },

  // 🚨 修正 2：新增功能，用於從雲端載入數據後，更新整個本地儲存
  saveAllTransactions: (transactions: Transaction[]): void => {
    localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(transactions));
  },

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
      // 🚨 修正：使用新的正規化函式
      let normalizedStatus = normalizeStatus(cloudTx.status); 

      const index = localTxs.findIndex(t => t.id === cloudTx.id);
      if (index >= 0) {
        localTxs[index] = {
          ...localTxs[index],
          status: normalizedStatus, 
          // Update display names if provided by cloud
          categoryName: cloudTx.categoryName || localTxs[index].categoryName,
          projectName: cloudTx.projectName || localTxs[index].projectName,
          recordedByName: cloudTx.recordedByName || localTxs[index].recordedByName,
        };
      } else {
        // If it exists in cloud but not local, add it
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
