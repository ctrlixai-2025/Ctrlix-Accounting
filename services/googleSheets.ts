import { storageService } from './storage';
import { Category, ProjectDept, Role, Transaction, User } from '../types';

// ----------------------------------------------
// 輔助介面和變數
// ----------------------------------------------

interface GasResponse {
    result: "success" | "error";
    error?: string;
    message?: string;
    // doGet 讀取所有數據時的回傳結構
    headers?: string[]; 
    data?: any[][];
    // doPost 寫入成功時的回傳動作
    action?: 'updated' | 'added' | 'deleted' | 'not_found'; 
}

/**
 * 檢查 GAS API 回應是否成功，失敗則拋出錯誤。
 * @param result GAS API 回傳的結果物件
 */
function checkGasResponse(result: GasResponse): void {
    if (result.result !== 'success') {
        const errorMsg = result.error || result.message || '未知雲端同步錯誤';
        console.error('GAS 服務操作失敗:', errorMsg);
        throw new Error(`雲端操作失敗: ${errorMsg}`);
    }
}

// ----------------------------------------------
// Google Sheets Service 核心功能
// ----------------------------------------------

export const googleSheetsService = {
  
  // 1. 【修正與強化】同步交易 (確保可靠性，拋出錯誤)
  syncTransaction: async (
    tx: Transaction,
    user: User,
    categoryName: string,
    projectName: string,
    methodName: string
  ): Promise<void> => { // 必須回傳 Promise<void> 且能被 await
    const scriptUrl = storageService.getGoogleScriptUrl();
    if (!scriptUrl) throw new Error("GAS Script URL 未設定，無法同步。"); // 拋出錯誤

    const payload = {
      // 移除 dataType: 'TRANSACTION'，讓它命中 GAS doPost 的 else 區塊
      id: tx.id,
      date: tx.date,
      type: tx.type,
      amount: tx.amount,
      summary: tx.summary,
      categoryName,
      projectName,
      methodName,
      hasTaxId: tx.hasTaxId,
      status: tx.status,
      recordedByName: user.name,
      createdAt: tx.createdAt, // 確保 timestamp 傳遞
      attachmentUrl: tx.attachmentUrl || '' // 確保圖片 URL 傳遞
    };

    try {
      const response = await fetch(scriptUrl, {
        method: 'POST',
        // 🚨 移除 'no-cors' 和 'keepalive' 以確保能夠讀取回傳結果和錯誤
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result: GasResponse = await response.json();
      checkGasResponse(result); // 檢查結果是否成功
      console.log(`交易同步成功: ${result.action}`);

    } catch (error) {
      console.error('Google Sheet Sync Error:', error);
      throw error; // 重新拋出錯誤，讓前端表單可以捕獲
    }
  },

  // 1.5 【修正與強化】刪除交易 (確保可靠性，拋出錯誤)
  deleteTransaction: async (id: string): Promise<void> => {
    const scriptUrl = storageService.getGoogleScriptUrl();
    if (!scriptUrl) throw new Error("GAS Script URL 未設定，無法同步。");

    const payload = {
      dataType: 'DELETE_TRANSACTION',
      id: id
    };

    try {
      const response = await fetch(scriptUrl, {
        method: 'POST',
        // 🚨 移除 'no-cors' 和 'keepalive'
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result: GasResponse = await response.json();
      checkGasResponse(result); // 檢查結果是否成功
      console.log(`交易刪除成功: ${result.action}`);

    } catch (error) {
      console.error('Delete Transaction Error:', error);
      throw error;
    }
  },

  // 2. 【修正】同步分類 (確保可靠性)
  syncCategory: async (category: Category, action: 'ADD' | 'DELETE'): Promise<void> => {
    const scriptUrl = storageService.getGoogleScriptUrl();
    if (!scriptUrl) return;

    const payload = {
      dataType: 'CATEGORY',
      action: action,
      id: category.id,
      name: category.name,
      type: category.type
    };

    try {
      const response = await fetch(scriptUrl, {
        method: 'POST',
        // 🚨 移除 'no-cors' 和 'keepalive'
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result: GasResponse = await response.json();
      checkGasResponse(result);
    } catch (error) {
      console.error('Category Sync Error:', error);
      throw error;
    }
  },

  // 3. 【修正】同步專案 (確保可靠性)
  syncProject: async (project: ProjectDept, action: 'ADD' | 'DELETE'): Promise<void> => {
    const scriptUrl = storageService.getGoogleScriptUrl();
    if (!scriptUrl) return;

    const payload = {
      dataType: 'PROJECT',
      action: action,
      id: project.id,
      name: project.name
    };

    try {
      const response = await fetch(scriptUrl, {
        method: 'POST',
        // 🚨 移除 'no-cors' 和 'keepalive'
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result: GasResponse = await response.json();
      checkGasResponse(result);
    } catch (error) {
      console.error('Project Sync Error:', error);
      throw error;
    }
  },

  // 4. Fetch Users (保持不變, 仍使用 Query Param)
  fetchUsers: async (): Promise<User[]> => {
    // ... 保持原來的邏輯 ...
    const scriptUrl = storageService.getGoogleScriptUrl();
    if (!scriptUrl) return [];

    try {
      // 確保使用 cache: 'no-store' 獲取最新數據
      const response = await fetch(`${scriptUrl}?action=getUsers&t=${Date.now()}`, { cache: 'no-store' });
      if (response.ok) {
        const rawUsers = await response.json();
        // Map Chinese roles to Enum if necessary
        return rawUsers.map((u: any) => {
            let role = Role.EMPLOYEE;
            const r = (u.role || '').toUpperCase().trim();
            if (r === 'MANAGER' || r === '管理員' || r === '主管') {
                role = Role.MANAGER;
            }
            return {
                ...u,
                role
            };
        });
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
    return [];
  },

  // 5. Fetch Categories (保持不變, 仍使用 Query Param)
  fetchCategories: async (): Promise<Category[]> => {
    // ... 保持原來的邏輯 ...
    const scriptUrl = storageService.getGoogleScriptUrl();
    if (!scriptUrl) return [];

    try {
      // 確保使用 cache: 'no-store' 獲取最新數據
      const response = await fetch(`${scriptUrl}?action=getCategories&t=${Date.now()}`, { cache: 'no-store' });
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
    return [];
  },

  // 6. Fetch Projects (保持不變, 仍使用 Query Param)
  fetchProjects: async (): Promise<ProjectDept[]> => {
    // ... 保持原來的邏輯 ...
    const scriptUrl = storageService.getGoogleScriptUrl();
    if (!scriptUrl) return [];

    try {
      // 確保使用 cache: 'no-store' 獲取最新數據
      const response = await fetch(`${scriptUrl}?action=getProjects&t=${Date.now()}`, { cache: 'no-store' });
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
    return [];
  },
  
  // 7. 【核心修正】讀取所有交易記錄 (使用新的 GAS doGet 接口)
  //    此函式應取代原來的 'Fetch Transaction Status' 邏輯，
  //    用於應用程式啟動時載入所有雲端數據，解決跨瀏覽器同步問題。
  fetchTransactions: async (): Promise<{ headers: string[], data: any[][] }> => {
    const scriptUrl = storageService.getGoogleScriptUrl();
    if (!scriptUrl) return { headers: [], data: [] };

    try {
      // 直接呼叫 GAS Web App URL (GET 請求會觸發 doGet)
      const response = await fetch(scriptUrl, {
          method: 'GET',
          cache: 'no-store', // 確保每次都獲取最新數據
      });

      const result: GasResponse = await response.json();
      checkGasResponse(result); 

      if (result.headers && result.data) {
          console.log('成功從 Google Sheet 載入所有交易。');
          return { headers: result.headers, data: result.data };
      } else {
           throw new Error('GAS 讀取操作成功，但數據結構錯誤。');
      }

    } catch (error) {
      console.error('Failed to fetch ALL transactions from cloud:', error);
      // 即使失敗也回傳空數據，讓應用程式可以啟動
      return { headers: [], data: [] };
    }
  }
};
