// --- Google Apps Script (請更新 doPost 區塊) ---

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var data = JSON.parse(e.postData.contents);
    
    // 分流判斷
    if (data.dataType === 'CATEGORY') {
      return handleCategoryUpdate(ss, data);
    } else if (data.dataType === 'PROJECT') {
      return handleProjectUpdate(ss, data);
    } else if (data.dataType === 'DELETE_TRANSACTION') { 
      // *** 新增這一段 ***
      return handleDeleteTransaction(ss, data);
    } else {
      return handleTransactionUpdate(ss, data);
    }

  } catch (e) {
    return outputJSON({result: "error", error: e.toString()});
  } finally {
    lock.releaseLock();
  }
}

// *** 新增這個處理刪除的函式 ***
function handleDeleteTransaction(ss, data) {
  var sheet = ss.getSheetByName("Transactions");
  if (!sheet) return outputJSON({result: "error", message: "Sheet not found"});
  
  var rows = sheet.getDataRange().getValues();
  // 從後面往回找，避免刪除列時索引跑掉
  for (var i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][0]) == String(data.id)) { // 比對 ID
      sheet.deleteRow(i + 1);
      return outputJSON({result: "success"});
    }
  }
  return outputJSON({result: "not_found"});
}

// ... 其他原本的 handleCategoryUpdate, handleTransactionUpdate 等函式保持不變 ...
