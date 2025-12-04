import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { storageService } from '../services/storage';
import { googleSheetsService } from '../services/googleSheets';
import { analyzeReceipt } from '../services/gemini';
import { Role, Transaction, TransactionStatus, TransactionType, User } from '../types';
import { Camera, Save, ArrowLeft, Loader2, Sparkles, Image as ImageIcon, Trash2 } from 'lucide-react';

interface Props {
  user: User;
}

// Utility to compress image before storage/upload
// Optimized for Google Apps Script payload limits (keep under 500KB preferably)
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;  // Reduced from 1024 to 800 for safety
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Compress to JPEG with 0.6 quality (good balance for receipts)
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        } else {
            resolve(event.target?.result as string);
        }
      };
      img.onerror = () => {
          resolve(event.target?.result as string);
      }
    };
  });
};

export const TransactionForm: React.FC<Props> = ({ user }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  
  const categories = storageService.getCategories().filter(c => c.isActive);
  const projects = storageService.getProjects().filter(p => p.isActive);
  const paymentMethods = storageService.getPaymentMethods().filter(pm => pm.isActive);

  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [formData, setFormData] = useState<Partial<Transaction>>({
    date: new Date().toISOString().split('T')[0],
    type: TransactionType.EXPENSE,
    status: TransactionStatus.PENDING,
    recordedById: user.id,
    amount: 0,
    summary: '',
    hasTaxId: false,
    paymentMethodId: paymentMethods[0]?.id || '',
    categoryId: categories[0]?.id || '',
    projectDeptId: projects[0]?.id || ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) {
      const tx = storageService.getTransactions().find(t => t.id === id);
      if (tx) {
        // Permission check
        if (user.role === Role.EMPLOYEE && tx.recordedById !== user.id && tx.recordedByName !== user.name) {
          alert('無權限編輯此記錄');
          navigate('/transactions');
          return;
        }
        setFormData(tx);
      }
    } else {
        // Set defaults for new transaction if lists are loaded
        setFormData(prev => ({
            ...prev,
            paymentMethodId: prev.paymentMethodId || paymentMethods[0]?.id || '',
            categoryId: prev.categoryId || categories[0]?.id || '',
            projectDeptId: prev.projectDeptId || projects[0]?.id || ''
        }));
    }
  }, [id, user, navigate]); 

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'number') {
        setFormData(prev => ({ ...prev, [name]: Number(value) }));
    } else if (name === 'hasTaxId') {
        // handled separately by toggle
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsAnalyzing(true);
      try {
        const compressed = await compressImage(file);
        
        // 1. Save Image to State
        setFormData(prev => ({ ...prev, attachmentUrl: compressed }));

        // 2. AI Analysis
        const result = await analyzeReceipt(compressed);
        
        setFormData(prev => ({
          ...prev,
          amount: result.amount || prev.amount,
          date: result.date || prev.date,
          summary: result.summary || prev.summary,
          hasTaxId: result.hasTaxId ?? prev.hasTaxId
        }));
      } catch (error) {
        console.error('Error processing image', error);
        alert('照片處理失敗，請重試');
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
        const newTx: Transaction = {
            ...formData as Transaction,
            id: formData.id || `t_${Date.now()}`,
            createdAt: formData.createdAt || Date.now(),
            recordedById: user.id,
            recordedByName: user.name // Cache name for offline view
        };

        // 1. Save Local
        storageService.saveTransaction(newTx);

        // 2. Sync to Google Sheet (Async but we await to confirm image upload if possible)
        const catName = categories.find(c => c.id === newTx.categoryId)?.name || '';
        const projName = projects.find(p => p.id === newTx.projectDeptId)?.name || '';
        const pmName = paymentMethods.find(p => p.id === newTx.paymentMethodId)?.name || '';
        
        // We await this to ensure the image is uploaded before navigating
        // If it fails, the error is logged but we still let the user proceed as it's saved locally
        await googleSheetsService.syncTransaction(newTx, user, catName, projName, pmName);

        navigate('/transactions');
    } catch (error) {
        console.error('Save failed', error);
        alert('儲存發生錯誤，請重試');
    } finally {
        setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !window.confirm('確定要刪除此筆記錄嗎？')) return;
    setIsLoading(true);
    storageService.deleteTransaction(id);
    await googleSheetsService.deleteTransaction(id);
    setIsLoading(false);
    navigate('/transactions');
  };

  return (
    <div className="max-w-xl mx-auto pb-10">
      <div className="flex items-center mb-6">
        <button onClick={() => navigate(-1)} className="mr-4 p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <h1 className="text-2xl font-bold text-gray-800">
            {id ? '編輯記錄' : '新增支出/收入'}
        </h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Image / AI Section */}
        <div className="bg-blue-50 p-6 text-center border-b border-blue-100">
            <input 
                type="file" 
                accept="image/*" 
                capture="environment"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
            />
            
            {formData.attachmentUrl ? (
                <div className="relative inline-block">
                    <img 
                        src={formData.attachmentUrl} 
                        alt="Receipt" 
                        className="max-h-64 rounded-lg shadow-md border border-gray-200" 
                    />
                    <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-2 right-2 bg-black/70 text-white p-2 rounded-full"
                    >
                        <Edit2Icon className="w-4 h-4" />
                    </button>
                    {isAnalyzing && (
                        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center rounded-lg text-white">
                            <Sparkles className="w-8 h-8 animate-spin mb-2 text-yellow-300" />
                            <span className="text-sm font-bold">AI 辨識中...</span>
                        </div>
                    )}
                </div>
            ) : (
                <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isAnalyzing}
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-blue-300 rounded-lg hover:bg-blue-100 transition-colors"
                >
                    {isAnalyzing ? (
                        <>
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                            <span className="text-sm text-blue-600">處理中...</span>
                        </>
                    ) : (
                        <>
                            <Camera className="w-8 h-8 text-blue-500 mb-2" />
                            <span className="text-sm font-medium text-blue-700">拍照或上傳收據 (AI 自動辨識)</span>
                        </>
                    )}
                </button>
            )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Type Selector */}
            <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: TransactionType.EXPENSE }))}
                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                        formData.type === TransactionType.EXPENSE 
                        ? 'bg-white text-red-600 shadow-sm' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    支出 (Expense)
                </button>
                <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: TransactionType.INCOME }))}
                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                        formData.type === TransactionType.INCOME 
                        ? 'bg-white text-green-600 shadow-sm' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    收入 (Income)
                </button>
            </div>

            {/* Date & Amount */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">日期</label>
                    <input
                        type="date"
                        name="date"
                        required
                        value={formData.date}
                        onChange={handleInputChange}
                        className="w-full p-3 border rounded-lg bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-200"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">金額</label>
                    <input
                        type="number"
                        name="amount"
                        required
                        min="0"
                        value={formData.amount}
                        onChange={handleInputChange}
                        className="w-full p-3 border rounded-lg bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-200 text-lg font-bold"
                    />
                </div>
            </div>

            {/* Summary */}
            <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">摘要說明</label>
                <input
                    type="text"
                    name="summary"
                    required
                    placeholder="例如：午餐會議、購買文具"
                    value={formData.summary}
                    onChange={handleInputChange}
                    className="w-full p-3 border rounded-lg bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-200"
                />
            </div>

            {/* Categories & Projects */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">會計科目</label>
                    <select
                        name="categoryId"
                        value={formData.categoryId}
                        onChange={handleInputChange}
                        className="w-full p-3 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-200"
                    >
                        {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">專案/部門</label>
                    <select
                        name="projectDeptId"
                        value={formData.projectDeptId}
                        onChange={handleInputChange}
                        className="w-full p-3 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-200"
                    >
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Payment Method & Tax ID */}
            <div className="grid grid-cols-2 gap-4 items-center">
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">支付方式</label>
                    <select
                        name="paymentMethodId"
                        value={formData.paymentMethodId}
                        onChange={handleInputChange}
                        className="w-full p-3 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-200"
                    >
                        {paymentMethods.map(pm => (
                            <option key={pm.id} value={pm.id}>{pm.name}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center pt-5">
                    <label className="flex items-center cursor-pointer select-none">
                        <div className="relative">
                            <input 
                                type="checkbox" 
                                className="sr-only" 
                                checked={formData.hasTaxId}
                                onChange={e => setFormData(prev => ({ ...prev, hasTaxId: e.target.checked }))}
                            />
                            <div className={`block w-14 h-8 rounded-full transition-colors ${formData.hasTaxId ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${formData.hasTaxId ? 'transform translate-x-6' : ''}`}></div>
                        </div>
                        <span className="ml-3 text-sm font-medium text-gray-700">有統編?</span>
                    </label>
                </div>
            </div>

            {/* Actions */}
            <div className="pt-4 flex gap-3">
                {id && (
                   <button
                        type="button"
                        onClick={handleDelete}
                        disabled={isLoading}
                        className="flex-none px-4 py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors"
                   >
                        <Trash2 className="w-5 h-5" />
                   </button>
                )}
                <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 flex items-center justify-center"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                            {id ? '更新並同步...' : '儲存並同步...'}
                        </>
                    ) : (
                        <>
                            <Save className="w-5 h-5 mr-2" />
                            {id ? '更新記錄' : '儲存記錄'}
                        </>
                    )}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

// Helper Icon for the edit overlay
const Edit2Icon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
);
