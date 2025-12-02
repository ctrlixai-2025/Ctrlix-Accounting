import { storageService } from './storage';
import { Transaction, User } from '../types';

export const googleSheetsService = {
  // 1. Submit Data (Fire and Forget)
  syncTransaction: async (
    tx: Transaction,
    user: User,
    categoryName: string,
    projectName: string,
    methodName: string
  ) => {
    const scriptUrl = storageService.getGoogleScriptUrl();
    if (!scriptUrl) return;

    const payload = {
      id: tx.id, // Important: ID is used for merging/updating status later
      date: tx.date,
      type: tx.type,
      amount: tx.amount,
      summary: tx.summary,
      categoryName,
      projectName,
      methodName,
      hasTaxId: tx.hasTaxId,
      status: tx.status,
      recordedByName: user.name
    };

    try {
      // mode: 'no-cors' is CRITICAL for submission to avoid blocking.
      // This means we won't get a response, but the browser won't wait for one either.
      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      console.log('Sent to Google Sheet (Background)');
    } catch (error) {
      console.error('Google Sheet Sync Error:', error);
    }
  },

  // 2. Fetch Users (GET)
  fetchUsers: async (): Promise<User[]> => {
    const scriptUrl = storageService.getGoogleScriptUrl();
    if (!scriptUrl) return [];

    try {
      // GET requests usually work with CORS if the GAS is set to "Anyone"
      const response = await fetch(`${scriptUrl}?action=getUsers`);
      if (response.ok) {
        const users = await response.json();
        return users;
      }
    } catch (error) {
      console.error('Failed to fetch users from cloud:', error);
    }
    return [];
  },

  // 3. Fetch Transactions Status (GET)
  fetchTransactions: async (userId: string): Promise<Transaction[]> => {
    const scriptUrl = storageService.getGoogleScriptUrl();
    if (!scriptUrl) return [];

    try {
      // We pass userId so the script can filter, or returns all and we filter locally
      const response = await fetch(`${scriptUrl}?action=getTransactions&userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        return data as Transaction[];
      }
    } catch (error) {
      console.error('Failed to fetch transactions from cloud:', error);
    }
    return [];
  }
};