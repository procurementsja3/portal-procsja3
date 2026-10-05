/**
 * =========================================================================
 * SIBIKOM - Google Apps Script Terpadu (Sistem Biji Kopi Manajemen)
 * PT Santos Jaya Abadi 3 (SJA3) - Departemen Gudang & Supply Chain
 * =========================================================================
 * 
 * FUNGSI UTAMA:
 * 1. Menghapus data di Google Sheet berdasarkan ID Permintaan (FORM_PERMINTAAN_UPBM)
 *    serta ID pada sheet lainnya (ID_LOT, ID_KELUAR, NO_PO, dll).
 * 2. Menerima penambahan data baru (INSERT) untuk semua modul SIBIKOM.
 * 3. Menyajikan data dalam format JSON untuk pembacaan aplikasi (doGet).
 *
 * CARA MEMASANG / MENGGUNAKAN:
 * 1. Buka Google Spreadsheet SIBIKOM Anda.
 * 2. Klik menu 'Ekstensi' (Extensions) > 'Apps Script'.
 * 3. Ganti / hapus seluruh kode lama di 'Code.gs' dengan seluruh kode ini.
 * 4. Klik ikon Simpan (Save).
 * 5. Klik 'Terapkan' (Deploy) > 'Kelola penerapan' (Manage deployments) > Edit (ikon pensil).
 * 6. Ubah Versi menjadi 'Versi baru' (New version), lalu klik 'Terapkan' (Deploy).
 */

/**
 * 1. doGet: Membaca data dari Sheet dalam format JSON
 */
function doGet(e) {
  try {
    var p = (e && e.parameter) ? e.parameter : {};
    var sheetName = p.sheet || p.sheetName || "FORM_PERMINTAAN_UPBM";
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Sheet '" + sheetName + "' tidak ditemukan."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var data = getSheetRowsAsObjects(sheet);
    var callback = p.callback;
    if (callback) {
      return ContentService.createTextOutput(callback + "(" + JSON.stringify({
        status: "success",
        sheet: sheetName,
        total: data.length,
        timestamp: new Date().toISOString(),
        data: data
      }) + ")").setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      sheet: sheetName,
      total: data.length,
      timestamp: new Date().toISOString(),
      data: data
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 2. doPost: Menerima aksi HAPUS (DELETE) dan SIMPAN (INSERT) data
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // Kunci proses selama 15 detik agar tidak terjadi konflik data bersamaan
    lock.waitLock(15000);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var p = (e && e.parameter) ? e.parameter : {};

    // Jika data dikirimkan sebagai payload JSON di body
    if (e && e.postData && e.postData.contents) {
      try {
        var jsonBody = JSON.parse(e.postData.contents);
        for (var k in jsonBody) {
          p[k] = jsonBody[k];
        }
      } catch (ex) {}
    }

    var action = String(p.action || "").toLowerCase().trim();
    var sheetName = String(p.sheetName || p.sheet || "FORM_PERMINTAAN_UPBM").trim();
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Sheet '" + sheetName + "' tidak ditemukan di Spreadsheet ini."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ==============================================================
    // PERINTAH: HAPUS DATA (DELETE) SESUAI ID PERMINTAAN / ID TARGET
    // ==============================================================
    if (action === "delete" || action === "hapus") {
      var targetId = String(
        p.ID_PERMINTAAN || 
        p.id || 
        p.ID_LOT || 
        p.ID_KELUAR || 
        p.NO_PO || 
        (p.columnName ? p[p.columnName] : "") || 
        ""
      ).trim();

      var keyColName = String(
        p.columnName || 
        (sheetName === "FORM_PERMINTAAN_UPBM" ? "ID_PERMINTAAN" : 
        (sheetName === "INPUT_PENERIMAAN_KOPI" ? "ID_LOT" : 
        (sheetName === "INPUT_TRANSAKSI_KELUAR" ? "ID_KELUAR" : 
        (sheetName === "INPUT_PO_SUPPLIER" ? "NO_PO" : ""))))
      ).trim();

      if (!targetId) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "error",
          message: "Parameter ID untuk penghapusan data tidak ditemukan."
        })).setMimeType(ContentService.MimeType.JSON);
      }

      var lastRow = sheet.getLastRow();
      var lastCol = sheet.getLastColumn();
      if (lastRow < 2) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "warning",
          message: "Sheet kosong atau tidak ada data yang dapat dihapus."
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // Deteksi letak indeks kolom ID berdasarkan baris header (Baris 1)
      var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      var targetColIdx = -1;
      
      for (var c = 0; c < headers.length; c++) {
        var hName = String(headers[c]).trim().toUpperCase();
        if (hName === keyColName.toUpperCase() || 
           (keyColName === "ID_PERMINTAAN" && (hName.indexOf("PERMINTAAN") !== -1 && hName.indexOf("ID") !== -1))) {
          targetColIdx = c + 1;
          break;
        }
      }

      var deletedCount = 0;
      var cleanTargetId = targetId.toUpperCase();

      // Loop dari baris paling bawah ke atas agar penghapusan baris tidak menggeser indeks baris sebelumnya
      for (var r = lastRow; r >= 2; r--) {
        var match = false;
        
        if (targetColIdx !== -1) {
          var cellVal = String(sheet.getRange(r, targetColIdx).getValue()).trim().toUpperCase();
          if (cellVal === cleanTargetId) {
            match = true;
          }
        } else {
          // Fallback: Jika nama kolom tidak cocok persis, periksa seluruh kolom pada baris tersebut
          var rowVals = sheet.getRange(r, 1, 1, lastCol).getValues()[0];
          for (var col = 0; col < rowVals.length; col++) {
            if (String(rowVals[col]).trim().toUpperCase() === cleanTargetId) {
              match = true;
              break;
            }
          }
        }

        if (match) {
          sheet.deleteRow(r);
          deletedCount++;
        }
      }

      SpreadsheetApp.flush();

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Data dengan ID " + targetId + " berhasil dihapus dari sheet " + sheetName + ".",
        deletedCount: deletedCount
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ==============================================================
    // PERINTAH: EDIT / UPDATE DATA BERDASARKAN ID PERMINTAAN / ID TARGET
    // ==============================================================
    if (action === "edit" || action === "update") {
      var targetId = String(
        p.ID_PERMINTAAN || 
        p.id || 
        p.ID_LOT || 
        p.ID_KELUAR || 
        p.NO_PO || 
        (p.columnName ? p[p.columnName] : "") || 
        ""
      ).trim();

      var keyColName = String(
        p.columnName || 
        (sheetName === "FORM_PERMINTAAN_UPBM" ? "ID_PERMINTAAN" : 
        (sheetName === "INPUT_PENERIMAAN_KOPI" ? "ID_LOT" : 
        (sheetName === "INPUT_TRANSAKSI_KELUAR" ? "ID_KELUAR" : 
        (sheetName === "INPUT_PO_SUPPLIER" ? "NO_PO" : ""))))
      ).trim();

      if (!targetId) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "error",
          message: "Parameter ID untuk pembaruan (edit) data tidak ditemukan."
        })).setMimeType(ContentService.MimeType.JSON);
      }

      var lastRow = sheet.getLastRow();
      var lastCol = sheet.getLastColumn();
      if (lastRow < 2) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "warning",
          message: "Sheet kosong atau tidak ada data yang dapat diedit."
        })).setMimeType(ContentService.MimeType.JSON);
      }

      var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      var targetColIdx = -1;
      
      for (var c = 0; c < headers.length; c++) {
        var hName = String(headers[c]).trim().toUpperCase();
        if (hName === keyColName.toUpperCase() || 
           (keyColName === "ID_PERMINTAAN" && (hName.indexOf("PERMINTAAN") !== -1 && hName.indexOf("ID") !== -1))) {
          targetColIdx = c + 1;
          break;
        }
      }

      var foundRow = -1;
      var cleanTargetId = targetId.toUpperCase();

      for (var r = 2; r <= lastRow; r++) {
        if (targetColIdx !== -1) {
          var cellVal = String(sheet.getRange(r, targetColIdx).getValue()).trim().toUpperCase();
          if (cellVal === cleanTargetId) {
            foundRow = r;
            break;
          }
        } else {
          var rowVals = sheet.getRange(r, 1, 1, lastCol).getValues()[0];
          for (var col = 0; col < rowVals.length; col++) {
            if (String(rowVals[col]).trim().toUpperCase() === cleanTargetId) {
              foundRow = r;
              break;
            }
          }
          if (foundRow !== -1) break;
        }
      }

      if (foundRow === -1) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "error",
          message: "Data dengan ID " + targetId + " tidak ditemukan di sheet " + sheetName + "."
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // Perbarui kolom yang nilainya dikirimkan dari aplikasi
      for (var c = 0; c < headers.length; c++) {
        var colHeader = String(headers[c]).trim();
        var newVal = undefined;

        if (p[colHeader] !== undefined) {
          newVal = p[colHeader];
        } else {
          var cleanCol = colHeader.toLowerCase().replace(/[^a-z0-9]/g, "");
          for (var paramKey in p) {
            if (paramKey.toLowerCase().replace(/[^a-z0-9]/g, "") === cleanCol) {
              newVal = p[paramKey];
              break;
            }
          }
        }

        // Tulis nilai baru ke sel di baris terkait
        if (newVal !== undefined && newVal !== null) {
          sheet.getRange(foundRow, c + 1).setValue(newVal);
        }
      }

      SpreadsheetApp.flush();

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Data dengan ID " + targetId + " pada baris " + foundRow + " berhasil diperbarui di sheet " + sheetName + "."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ==============================================================
    // PERINTAH: TAMBAH DATA BARU (INSERT)
    // ==============================================================
    var lastCol = Math.max(sheet.getLastColumn(), 1);
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var newRow = [];

    for (var c = 0; c < headers.length; c++) {
      var colHeader = String(headers[c]).trim();
      var val = "";

      if (p[colHeader] !== undefined) {
        val = p[colHeader];
      } else {
        // Pencarian alternatif tanpa spasi & case-insensitive
        var cleanCol = colHeader.toLowerCase().replace(/[^a-z0-9]/g, "");
        for (var paramKey in p) {
          if (paramKey.toLowerCase().replace(/[^a-z0-9]/g, "") === cleanCol) {
            val = p[paramKey];
            break;
          }
        }
      }
      newRow.push(val !== undefined && val !== null ? val : "");
    }

    sheet.appendRow(newRow);
    SpreadsheetApp.flush();

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Data berhasil disimpan ke sheet " + sheetName + "."
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Helper: Mengonversi data sheet menjadi array objek JSON
 */
function getSheetRowsAsObjects(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var result = [];

  for (var i = 0; i < rows.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var h = String(headers[j]).trim();
      if (h) {
        obj[h] = rows[i][j];
      }
    }
    result.push(obj);
  }
  return result;
}
