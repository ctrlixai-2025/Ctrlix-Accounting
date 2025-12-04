import { storageService } from './storage';
import { Category, ProjectDept, Role, Transaction, User } from '../types';

export const googleSheetsService = {
  // 1. Submit Transaction (Wait for completion to ensure image upload)
  syncTransaction: async (
    tx: Transaction,
    user: User,
    categoryName: string,
    projectName: string,
    methodName: string
  ) => {
    const scriptUrl = storageService.getGoogleScriptUrl();
    if (!scriptUrl) return;

    // Prepare payload matching the GAS expectation
    // GAS expects 'photoData' with full Data URL string for image upload
    const payload = {
      dataType: 'TRANSACTION',
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
      photoData: (tx.attachmentUrl && tx.attachmentUrl.startsWith('data:')) ? tx.attachmentUrl : ''
    };

    try {
      const response = await fetch(scriptUrl, {
        method: 'POST',
        // Removed 'no-cors' to allow reading the response (Drive URL)
        // GAS must return ContentService.createTextOutput(...).setMimeType(ContentService.MimeType.JSON)
        // AND user must be deployed as "Anyone"
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const result = await response.json();
      
      // If server returns a new photoURL (Drive Link), update local storage immediately
      if (result.photoUrl && result.photoUrl.startsWith('http')) {
        const currentTx = storageService.getTransactions().find(t => t.id === tx.id);
        if (currentTx) {
          currentTx.attachmentUrl = result.photoUrl;
          storageService.saveTransaction(currentTx);
        }
      }

      return result;
    } catch (error) {
      console.error('Google Sheet Sync Error:', error);
      // We don't throw here to allow "Offline" save to succeed locally even if sync fails
      // But for image upload, the user might want to know.
      // For now, we assume background sync will pick it up later or next load.
    }
  },

  // 1.5 Delete Transaction
  deleteTransaction: async (id: string) => {
    const scriptUrl = storageService.getGoogleScriptUrl();
    if (!scriptUrl) return;

    const payload = {
      dataType: 'DELETE_TRANSACTION',
      id: id
    };

    try {
      await fetch(scriptUrl, {
        method: 'POST',
        // Keep keepalive for deletes as they are small and we might navigate away
        keepalive: true, 
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('Delete Transaction Error:', error);
    }
  },

  // 2. Sync Category (Add/Delete)
  syncCategory: async (category: Category, action: 'ADD' | 'DELETE') => {
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
      await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('Category Sync Error:', error);
    }
  },

  // 3. Sync Project (Add/Delete)
  syncProject: async (project: ProjectDept, action: 'ADD' | 'DELETE') => {
    const scriptUrl = storageService.getGoogleScriptUrl();
    if (!scriptUrl) return;

    const payload = {
      dataType: 'PROJECT',
      action: action,
      id: project.id,
      name: project.name
    };

    try {
      await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('Project Sync Error:', error);
    }
  },

  // 4. Fetch Users
  fetchUsers: async (): Promise<User[]> => {
    const scriptUrl = storageService.getGoogleScriptUrl();
    if (!scriptUrl) return [];

    try {
      const response = await fetch(`${scriptUrl}?action=getUsers&t=${Date.now()}`);
      if (response.ok) {
        const rawUsers = await response.json();
        return rawUsers.map((u: any) => {
            let role = Role.EMPLOYEE;
            const r = (u.role || '').toUpperCase().trim();
            if (r === 'MANAGER' || r === '管理員' || r === '主管') {
                role = Role.MANAGER;
            }
            return { ...u, role };
        });
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
    return [];
  },

  // 5. Fetch Categories
  fetchCategories: async (): Promise<Category[]> => {
    const scriptUrl = storageService.getGoogleScriptUrl();
    if (!scriptUrl) return [];

    try {
      const response = await fetch(`${scriptUrl}?action=getCategories&t=${Date.now()}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
    return [];
  },

  // 6. Fetch Projects
  fetchProjects: async (): Promise<ProjectDept[]> => {
    const scriptUrl = storageService.getGoogleScriptUrl();
    if (!scriptUrl) return [];

    try {
      const response = await fetch(`${scriptUrl}?action=getProjects&t=${Date.now()}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
    return [];
  },

  // 7. Fetch Transaction Status
  fetchTransactions: async (userId: string): Promise<Transaction[]> => {
    const scriptUrl = storageService.getGoogleScriptUrl();
    if (!scriptUrl) return [];

    try {
      const response = await fetch(`${scriptUrl}?action=getTransactions&userId=${userId}&t=${Date.now()}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    }
    return [];
  }
};
